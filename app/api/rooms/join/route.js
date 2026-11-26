
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { isRoomExpired } from "@/lib/roomAccess";

export async function POST(request) {
  try {
    // 1. Check authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    // 2. Get invite code
    const body = await request.json();
    const inviteCode = body.inviteCode?.trim().toUpperCase();

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invite code is required." },
        { status: 400 }
      );
    }

    // 3. Find user in database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    // 4. Find room using invite code
    const room = await prisma.room.findUnique({
      where: { inviteCode },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Invalid invite code." },
        { status: 404 }
      );
    }

    const joinResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Room"
        WHERE "id" = ${room.id}
        FOR UPDATE
      `;

      const currentRoom = await tx.room.findUnique({
        where: { id: room.id },
      });

      if (!currentRoom || currentRoom.status === "ENDED") {
        return { status: "ended" };
      }

      if (isRoomExpired(currentRoom)) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: "ENDED", playbackIsPlaying: false },
        });
        return { status: "expired" };
      }

      if (currentRoom.status !== "WAITING") {
        return { status: "not-accepting" };
      }

      const existingMember = await tx.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        return { status: "already-member" };
      }

      const memberCount = await tx.roomMember.count({
        where: { roomId: room.id },
      });

      if (memberCount >= currentRoom.maxMembers) {
        return { status: "full" };
      }

      await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          role: "MEMBER",
        },
      });

      return { status: "joined" };
    });

    if (joinResult.status === "expired" || joinResult.status === "ended") {
      return NextResponse.json({
        error: "This room has ended or reached its time limit.",
      }, { status: 410 });
    }

    if (joinResult.status === "not-accepting") {
      return NextResponse.json(
        { error: "This room is not accepting new members." },
        { status: 400 }
      );
    }

    if (joinResult.status === "full") {
      return NextResponse.json(
        { error: "This room is full." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          joinResult.status === "already-member"
            ? "You are already a member of this room."
            : "Successfully joined the room.",
        room: {
          id: room.id,
          name: room.name,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Join Room Error:", error);

    if (error.code === "P2034") {
      return NextResponse.json(
        { error: "Room membership changed. Please try joining again." },
        { status: 409 }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "You are already a member of this room." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
