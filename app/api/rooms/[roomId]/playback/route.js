import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRoomAccess } from "@/lib/roomAccess";

function accessError(access) {
  return NextResponse.json(
    { error: access.error },
    { status: access.status }
  );
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

    return NextResponse.json({
      playback: {
        position: access.room.playbackPosition,
        isPlaying: access.room.playbackIsPlaying,
        updatedAt: access.room.playbackUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Get room playback error:", error);
    return NextResponse.json(
      { error: "Failed to load playback state" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const access = await getRoomAccess(roomId, userId);
    if (access.error) return accessError(access);

    if (!access.room.videoId) {
      return NextResponse.json(
        { error: "Upload a video before controlling playback" },
        { status: 409 }
      );
    }

    const body = await request.json();
    if (
      typeof body.position !== "number" ||
      !Number.isFinite(body.position) ||
      body.position < 0 ||
      typeof body.isPlaying !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid playback state" },
        { status: 400 }
      );
    }

    const playbackUpdatedAt = new Date();
    await prisma.room.update({
      where: { id: roomId },
      data: {
        playbackPosition: body.position,
        playbackIsPlaying: body.isPlaying,
        playbackUpdatedAt,
      },
    });

    return NextResponse.json({
      success: true,
      playback: {
        position: body.position,
        isPlaying: body.isPlaying,
        updatedAt: playbackUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Update room playback error:", error);
    return NextResponse.json(
      { error: "Failed to update playback state" },
      { status: 500 }
    );
  }
}
