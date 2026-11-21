
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";



export async function POST(request) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    

    // 2. Get room details
    const body = await request.json();
    const roomName = body.roomName?.trim();

    if (!roomName) {
      return NextResponse.json(
        { message: "Room name is required" },
        { status: 400 }
      );
    }

    if (roomName.length > 60) {
      return NextResponse.json(
        { message: "Room name must be under 60 characters" },
        { status: 400 }
      );
    }

    // 3. Find host in database
    const host = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!host) {
      return NextResponse.json(
        { message: "Please complete your profile first" },
        { status: 404 }
      );
    }

    // 4. Generate invite code
    const inviteCode = randomBytes(4)
      .toString("hex")
      .toUpperCase();

    // 5. Create room and add host as a member
    const room = await prisma.$transaction(async (tx) => {
      return tx.room.create({
        data: {
          name: roomName,
          hostId: host.id,
          inviteCode,
          members: {
            create: {
              userId: host.id,
              role: "HOST",
            },
          },
        },
        include: {
          members: true,
        },
      });
    });

    return NextResponse.json(
      {
        message: "Room created successfully",
        room: {
          id: room.id,
          name: room.name,
          inviteCode: room.inviteCode,
          status: room.status,
          members: room.members,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Create room error:", error);

    return NextResponse.json(
      { message: "Something went wrong while creating room" },
      { status: 500 }
    );
  }
}
