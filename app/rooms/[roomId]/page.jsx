"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import RoomChat from "@/components/RoomChat";
import RoomVideoPlayer from "@/components/RoomVideoPlayer";

const STATUS_STYLES = {
  WAITING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  ENDED: "bg-gray-500/10 text-gray-300 border-gray-500/30",
};

function Avatar({ user }) {
  if (user.imageUrl) {
    return (
      <img
        src={user.imageUrl}
        alt=""
        className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-800"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 font-semibold text-white ring-2 ring-gray-800">
      {user.name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6">
      <div className="h-4 w-24 rounded bg-gray-800" />
      <div className="h-10 w-2/3 rounded bg-gray-800" />
      <div className="aspect-video rounded-2xl bg-gray-900" />
    </div>
  );
}

export default function RoomPage({ params }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 px-6 py-16 text-white">
          <RoomSkeleton />
        </main>
      }
    >
      <RoomPageContent params={params} />
    </Suspense>
  );
}

function RoomPageContent({ params }) {
  const { roomId } = use(params);

  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch room details
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setError("Please login to access this room");
      setLoading(false);
      return;
    }

    async function fetchRoom() {
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load room");
        }

        setRoom(data.room);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRoom();
  }, [roomId, isLoaded, isSignedIn]);

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // End room (Host)
  async function EndRoom() {
    if (actionLoading) return;

    try {
      setActionLoading(true);

      const res = await fetch(`/api/rooms/${roomId}/end`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to end room");
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("End Room Error:", error);
      setError(error.message);
      setActionLoading(false);
    }
  }

  // Leave room (Member)
  async function LeaveRoom() {
    if (actionLoading) return;

    try {
      setActionLoading(true);

      const res = await fetch(`/api/rooms/${roomId}/leave`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to leave room");
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Leave Room Error:", error);
      setError(error.message);
      setActionLoading(false);
    }
  }

  if (loading || !isLoaded) {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-16 text-white">
        <RoomSkeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-red-950/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Couldn&apos;t open this room</h1>
          <p className="mt-3 text-sm text-red-300">{error}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium hover:bg-gray-800"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!room) return null;

  const currentUserRole = room.currentUserRole;
  const memberCount = room.members.length;
  const fillPercent = Math.min(100, (memberCount / room.maxMembers) * 100);
  const isFull = memberCount >= room.maxMembers;

  const statusStyle =
    STATUS_STYLES[room.status] ||
    "bg-purple-500/10 text-purple-300 border-purple-500/30";

  return (
    <main className="min-h-screen w-full bg-gray-950 px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white"
            >
              &larr; Dashboard
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {room.name}
              </h1>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyle}`}
              >
                {String(room.status).toLowerCase()}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-400">
              Hosted by{" "}
              <span className="text-gray-200">{room.host?.name || "Host"}</span>
            </p>
          </div>

          {currentUserRole === "HOST" && (
            <Button
              onClick={EndRoom}
              disabled={actionLoading}
              className="bg-red-600 px-6 hover:bg-red-700"
            >
              {actionLoading ? "Ending..." : "End Room"}
            </Button>
          )}
          {currentUserRole === "MEMBER" && (
            <Button
              onClick={LeaveRoom}
              disabled={actionLoading}
              className="bg-pink-500 px-6 hover:bg-pink-600"
            >
              {actionLoading ? "Leaving..." : "Leave Room"}
            </Button>
          )}
        </header>

        {/* Theater: video + chat */}
        {/* Mobile: video upar, chat neeche (alag).  md/lg+: chat video ke andar overlay */}
        <section className="flex flex-col gap-4 md:relative md:block md:aspect-video md:max-h-[100vh] md:w-full md:overflow-hidden md:rounded-2xl md:border md:border-gray-800 md:bg-black md:shadow-2xl md:shadow-black/50">
          {/* Video */}
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-gray-800 bg-black md:absolute md:inset-0 md:aspect-auto md:rounded-none md:border-0 [&>*]:h-full [&>*]:w-full">
            <RoomVideoPlayer
              roomId={room.id}
              isHost={currentUserRole === "HOST"}
            />
          </div>

          {/* Chat */}
          <div
            className="
              h-[120px] overflow-hidden rounded-2xl border border-gray-800 bg-gray-900
              md:pointer-events-none md:absolute md:inset-y-0 md:right-0 md:z-10 md:h-auto
              md:w-[280px] lg:w-[340px] xl:w-[380px]
              md:rounded-none md:border-0 md:bg-transparent
              md:[&>*]:pointer-events-auto md:[&>*]:h-full md:[&>*]:!bg-transparent md:[&>*]:!border-0 md:[&>*]:!shadow-none
            "
          >
            <RoomChat roomId={room.id} overlay />
          </div>
        </section>

        {/* Info row: invite + members */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Invite */}
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <p className="text-sm text-gray-400">Invite code</p>

            <code className="mt-2 block break-all text-3xl font-bold tracking-[0.25em] text-purple-300">
              {room.inviteCode}
            </code>

            <p className="mt-3 text-sm text-gray-500">
              Share this code with friends so they can join the room.
            </p>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-gray-400">Seats taken</span>
                  <span className="font-semibold">
                    {memberCount} / {room.maxMembers}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFull ? "bg-amber-400" : "bg-purple-500"
                    }`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>

              <Button
                onClick={copyInviteCode}
                variant="outline"
                className="cursor-pointer border-purple-500/50 bg-purple-600 px-5 text-white hover:bg-purple-500 hover:text-white"
              >
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
          </section>

          {/* Members */}
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">In the room</h2>
              <span className="text-sm text-gray-400">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
            </div>

            <ul className="mt-4 max-h-64 divide-y divide-gray-800 overflow-y-auto">
              {room.members.map((member) => (
                <li
                  key={member.user.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar user={member.user} />
                    <span className="font-medium">
                      {member.user.name || "User"}
                    </span>
                  </div>

                  {member.role === "HOST" && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
                      Host
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {!isFull && (
              <p className="mt-4 rounded-lg border border-dashed border-gray-700 px-4 py-3 text-center text-sm text-gray-500">
                {room.maxMembers - memberCount} open{" "}
                {room.maxMembers - memberCount === 1 ? "seat" : "seats"} left
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}