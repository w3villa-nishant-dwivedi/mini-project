
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { roomId } = await params;

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { message: "User profile not found" },
        { status: 404 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { message: "Room not found" },
        { status: 404 }
      );
    }

    if (room.status === "ENDED") {
  return NextResponse.json(
    { error: "This room has been ended by the host" },
    { status: 410 }
  );
}

    const isMember = room.members.some(
      (member) => member.userId === currentUser.id
    );

    if (!isMember) {
      return NextResponse.json(
        { message: "You are not a member of this room" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        inviteCode: room.inviteCode,
        status: room.status,
        isPrivate: room.isPrivate,
        maxMembers: room.maxMembers,
        createdAt: room.createdAt,
        host: room.host,
        currentUserRole: room.members.find(
          (member) => member.userId === currentUser.id
        )?.role,
        members: room.members.map((member) => ({
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
      },
    });

  } catch (error) {
    console.error("Get room error:", error);

    return NextResponse.json(
      { message: "Failed to fetch room details" },
      { status: 500 }
    );
  }
}
