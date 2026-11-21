"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play } from "lucide-react";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const formattedMinutes =
    hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);

  return `${hours > 0 ? `${hours}:` : ""}${formattedMinutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

async function readResponse(response, fallbackMessage) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

export default function RoomVideoPlayer({ roomId, isHost }) {
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [needsGesture, setNeedsGesture] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekPreview, setSeekPreview] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function updateFullscreenState() {
      setIsFullscreen(
        document.fullscreenElement === playerContainerRef.current
      );
    }

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const loadVideo = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomId}/video`, {
      cache: "no-store",
    });
    const data = await readResponse(response, "Could not load the room video");

    setVideo((currentVideo) =>
      currentVideo?.id === data.video?.id ? currentVideo : data.video
    );
  }, [roomId]);

  useEffect(() => {
    let active = true;

    async function pollVideo() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/video`, {
          cache: "no-store",
        });
        const data = await readResponse(response, "Could not load the room video");
        if (active) {
          setVideo((currentVideo) =>
            currentVideo?.id === data.video?.id ? currentVideo : data.video
          );
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }

    pollVideo();
    const intervalId = setInterval(pollVideo, 5000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [roomId]);

  useEffect(() => {
    let active = true;

    async function pollPlayback() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/playback`, {
          cache: "no-store",
        });
        const data = await readResponse(response, "Could not load playback state");
        if (active) setPlayback(data.playback);
      } catch (playbackError) {
        if (active) setError(playbackError.message);
      }
    }

    pollPlayback();
    const intervalId = setInterval(pollPlayback, 2000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [roomId]);

  const publishPlayback = useCallback(
    async (position, isPlaying) => {
      const response = await fetch(`/api/rooms/${roomId}/playback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, isPlaying }),
      });
      const data = await readResponse(response, "Could not sync playback");
      setPlayback(data.playback);
    },
    [roomId]
  );

  const syncViewer = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playback) return;

    const elapsed = playback.isPlaying
      ? Math.max(0, (Date.now() - new Date(playback.updatedAt).getTime()) / 1000)
      : 0;
    const targetPosition = playback.position + elapsed;

    if (
      Number.isFinite(targetPosition) &&
      player.readyState > 0 &&
      Math.abs(player.currentTime - targetPosition) > 1.5
    ) {
      player.currentTime = targetPosition;
    }

    if (playback.isPlaying && player.paused) {
      player.play()
        .then(() => setNeedsGesture(false))
        .catch(() => setNeedsGesture(true));
    } else if (!playback.isPlaying && !player.paused) {
      player.pause();
    }
  }, [playback]);

  useEffect(() => {
    syncViewer();
  }, [syncViewer, video]);

  async function uploadVideo(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    if (file.size > MAX_VIDEO_SIZE) {
      setError("Video must be 100 MB or smaller.");
      input.value = "";
      return;
    }

    setUploading(true);
    try {
      const uploadRequest = await fetch(`/api/rooms/${roomId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-upload-url",
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const uploadData = await readResponse(
        uploadRequest,
        "Could not start the video upload"
      );

      const storageResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!storageResponse.ok) {
        throw new Error(
          "Storj upload failed. Check that the bucket allows PUT requests from this site."
        );
      }

      const completeRequest = await fetch(`/api/rooms/${roomId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete-upload",
          key: uploadData.key,
          title: file.name,
        }),
      });
      await readResponse(completeRequest, "Could not finish the video upload");
      await loadVideo();
      setCurrentTime(0);
      setDuration(0);
      setSeekPreview(null);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function handleLoadedMetadata() {
    const player = playerRef.current;
    if (!player) return;

    setDuration(Number.isFinite(player.duration) ? player.duration : 0);
    setCurrentTime(player.currentTime);
    syncViewer();
  }

  function handleTimeUpdate() {
    const player = playerRef.current;
    if (!player) return;

    setCurrentTime(player.currentTime);
    if (Number.isFinite(player.duration) && player.duration > 0) {
      setDuration(player.duration);
    }
  }

  async function togglePlayback() {
    const player = playerRef.current;
    if (!player) return;

    const shouldPlay = player.paused;
    try {
      if (shouldPlay) {
        await player.play();
        setNeedsGesture(false);
      } else {
        player.pause();
      }
    } catch (playbackError) {
      if (shouldPlay) setNeedsGesture(true);
      setError(playbackError.message);
      return;
    }

    try {
      await publishPlayback(player.currentTime, shouldPlay);
    } catch (syncError) {
      setError(syncError.message);
    }
  }

  async function commitSeek(event) {
    const player = playerRef.current;
    if (!player) return;

    const position = Number(event.currentTarget.value);
    setCurrentTime(position);
    setSeekPreview(null);
    player.currentTime = position;

    try {
      await publishPlayback(position, !player.paused);
    } catch (syncError) {
      setError(syncError.message);
    }
  }

  async function handleVideoEnded() {
    const player = playerRef.current;
    if (!player) return;

    setIsPlaying(false);
    try {
      await publishPlayback(player.currentTime, false);
    } catch (syncError) {
      setError(syncError.message);
    }
  }

  async function toggleFullscreen() {
    const container = playerContainerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (fullscreenError) {
      setError(fullscreenError.message || "Could not open fullscreen mode.");
    }
  }

  const displayedTime = seekPreview ?? currentTime;
  const progressPercent =
    duration > 0
      ? Math.min(100, Math.max(0, (displayedTime / duration) * 100))
      : 0;

  return (
    <section className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      {video ? (
        <div
          ref={playerContainerRef}
          className={`overflow-hidden bg-black ${
            isFullscreen
              ? "fixed inset-0 z-[100] h-dvh w-screen rounded-none"
              : "absolute inset-0"
          }`}
        >
          <video
            ref={playerRef}
            key={video.id}
            src={video.playbackUrl}
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleVideoEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
          />

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
            <h2 className="min-w-0 truncate text-lg font-semibold text-white">
              Watch together
            </h2>
            {isHost && (
              <label className="shrink-0 cursor-pointer rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500">
                {uploading ? "Uploading..." : "Upload video"}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  disabled={uploading}
                  onChange={uploadVideo}
                />
              </label>
            )}
          </div>

          {needsGesture && (
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute inset-0 z-20 m-auto h-14 w-14 rounded-full bg-purple-600 p-4 text-white hover:bg-purple-500"
              aria-label="Start video playback"
            >
              <Play className="h-6 w-6" aria-hidden="true" />
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-3 pt-10 text-white sm:px-4 sm:pb-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <p className="min-w-0 flex-1 truncate text-sm text-gray-200">
                {video.title}
              </p>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Maximize className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs tabular-nums text-gray-200">
                {formatTime(displayedTime)}
              </span>
              <div className="relative flex h-8 min-w-0 flex-1 items-center rounded focus-within:ring-2 focus-within:ring-purple-400">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-400/70">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white ring-2 ring-purple-500"
                  style={{ left: `${progressPercent}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={displayedTime}
                  disabled={!duration}
                  aria-label="Seek video"
                  aria-valuetext={`${formatTime(displayedTime)} of ${formatTime(duration)}`}
                  onChange={(event) =>
                    setSeekPreview(Number(event.currentTarget.value))
                  }
                  onPointerUp={commitSeek}
                  onKeyUp={commitSeek}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-gray-200">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
            <h2 className="text-lg font-semibold text-white">Watch together</h2>
            {isHost && (
              <label className="shrink-0 cursor-pointer rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500">
                {uploading ? "Uploading..." : "Upload video"}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  disabled={uploading}
                  onChange={uploadVideo}
                />
              </label>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-400">
            {isHost
              ? "Upload a video to start watching together."
              : "Waiting for the host to upload a video."}
          </div>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="absolute inset-x-3 top-16 z-30 rounded bg-black/80 p-2 text-sm text-red-400 sm:inset-x-4"
        >
          {error}
        </p>
      )}
    </section>
  );
}
