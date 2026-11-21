
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import prisma from "@/lib/prisma";
import storj from "@/lib/storj";

export async function POST(request, { params }) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { roomId } = await params;

    // 2. Find current user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 3. Find room
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        video: {
          select: {
            id: true,
            storageKey: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // 4. Only host can end room
    if (room.hostId !== user.id) {
      return NextResponse.json(
        { error: "Only the host can end this room" },
        { status: 403 }
      );
    }

    // 5. Check if already ended
    if (room.status === "ENDED") {
      return NextResponse.json(
        { error: "Room is already ended" },
        { status: 400 }
      );
    }

    const sharedWithActiveRoom = room.video
      ? await prisma.room.count({
          where: {
            videoId: room.video.id,
            id: { not: roomId },
            status: { not: "ENDED" },
          },
        })
      : 0;

    if (room.video && sharedWithActiveRoom === 0) {
      const bucket = process.env.STORJ_BUCKET;
      if (!bucket) {
        throw new Error("STORJ_BUCKET is not configured");
      }

      await storj.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: room.video.storageKey,
        })
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: roomId },
        data: {
          status: "ENDED",
          videoId: null,
          playbackIsPlaying: false,
        },
      });

      if (room.video && sharedWithActiveRoom === 0) {
        await tx.video.delete({ where: { id: room.video.id } });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Room ended successfully",
    });

  } catch (error) {
    console.error("End Room Error:", error);

    return NextResponse.json(
      { error: "Failed to clean up the room video or end the room. Please retry." },
      { status: 500 }
    );
  }
}
