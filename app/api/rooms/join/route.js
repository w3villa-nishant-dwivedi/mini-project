
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "Invalid invite code." },
        { status: 404 }
      );
    }

    // 5. Check room status
    if (room.status !== "WAITING") {
      return NextResponse.json(
        { error: "This room is not accepting new members." },
        { status: 400 }
      );
    }

    // 6. Check existing membership
    const existingMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({
        success: true,
        message: "You are already a member of this room.",
        room: {
          id: room.id,
          name: room.name,
        },
      });
    }

    // 7. Check room capacity
    if (room._count.members >= room.maxMembers) {
      return NextResponse.json(
        { error: "This room is full." },
        { status: 409 }
      );
    }

    // 8. Add user as a member
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Successfully joined the room.",
        room: {
          id: room.id,
          name: room.name,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Join Room Error:", error);

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
