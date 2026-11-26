import { auth } from "@clerk/nextjs/server";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRoomAccess } from "@/lib/roomAccess";
import storj from "@/lib/storj";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getBucket() {
  const bucket = process.env.STORJ_BUCKET;
  if (!bucket) {
    throw new Error("STORJ_BUCKET is not configured");
  }
  return bucket;
}

function accessError(access) {
  return NextResponse.json(
    { error: access.error },
    { status: access.status }
  );
}

function formatFileSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1024
    ? `${Number((megabytes / 1024).toFixed(1))} GB`
    : `${megabytes} MB`;
}

export async function GET(_request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const access = await getRoomAccess(roomId, userId);
    if (access.error) return accessError(access);

    if (!access.room.videoId) {
      return NextResponse.json({ video: null });
    }

    const video = await prisma.video.findUnique({
      where: { id: access.room.videoId },
      select: {
        id: true,
        title: true,
        mimeType: true,
        storageKey: true,
      },
    });

    if (!video) {
      return NextResponse.json({ video: null });
    }

    const playbackUrl = await getSignedUrl(
      storj,
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: video.storageKey,
      }),
      { expiresIn: 12 * 60 * 60 }
    );

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        mimeType: video.mimeType,
        playbackUrl,
      },
    });
  } catch (error) {
    console.error("Get room video error:", error);
    return NextResponse.json(
      { error: "Failed to load the room video" },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  let action = "unknown";

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const access = await getRoomAccess(roomId, userId);
    if (access.error) return accessError(access);
    const maxUploadBytes = Number(access.room.maxUploadBytes);

    if (access.membership.role !== "HOST") {
      return NextResponse.json(
        { error: "Only the host can upload a room video" },
        { status: 403 }
      );
    }

    const body = await request.json();
    action = body.action;

    if (body.action === "create-upload-url") {
      const { contentType, fileSize } = body;
      if (
        !ALLOWED_VIDEO_TYPES.has(contentType) ||
        !Number.isInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > maxUploadBytes
      ) {
        return NextResponse.json(
          {
            error: `Choose an MP4, WebM, or MOV video up to ${formatFileSize(maxUploadBytes)}`,
          },
          { status: 400 }
        );
      }

      const key = `room-videos/${roomId}/${randomUUID()}`;
      const uploadUrl = await getSignedUrl(
        storj,
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          ContentType: contentType,
          ContentLength: fileSize,
        }),
        { expiresIn: 15 * 60 }
      );

      return NextResponse.json({ key, uploadUrl });
    }

    if (body.action === "complete-upload") {
      const { key, title } = body;
      if (
        typeof key !== "string" ||
        !key.startsWith(`room-videos/${roomId}/`) ||
        typeof title !== "string" ||
        !title.trim()
      ) {
        return NextResponse.json(
          { error: "Invalid video upload details" },
          { status: 400 }
        );
      }

      const bucket = getBucket();
      const uploadedObject = await storj.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key })
      );

      if (
        !uploadedObject.ContentLength ||
        uploadedObject.ContentLength > maxUploadBytes ||
        !ALLOWED_VIDEO_TYPES.has(uploadedObject.ContentType)
      ) {
        return NextResponse.json(
          {
            error: `The uploaded video is invalid or exceeds ${formatFileSize(maxUploadBytes)}`,
          },
          { status: 400 }
        );
      }

      const video = await prisma.$transaction(async (tx) => {
        const createdVideo = await tx.video.create({
          data: {
            title: title.trim().slice(0, 120),
            videoUrl: `storj://${bucket}/${key}`,
            storageKey: key,
            fileSize: BigInt(uploadedObject.ContentLength),
            mimeType: uploadedObject.ContentType,
            uploaderId: access.user.id,
          },
          select: {
            id: true,
            title: true,
            mimeType: true,
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: {
            videoId: createdVideo.id,
            playbackPosition: 0,
            playbackIsPlaying: false,
            playbackUpdatedAt: new Date(),
          },
        });

        return createdVideo;
      });

      return NextResponse.json({ success: true, video });
    }

    return NextResponse.json(
      { error: "Unknown video action" },
      { status: 400 }
    );
  } catch (error) {
    console.error(`Room video ${action} error:`, error);

    const message =
      action === "create-upload-url"
        ? "Could not create the Storj upload URL. Check the storage configuration."
        : action === "complete-upload"
          ? "The file uploaded, but could not be saved to the room. Check the Storj object and database."
          : "Could not process the room video upload.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
