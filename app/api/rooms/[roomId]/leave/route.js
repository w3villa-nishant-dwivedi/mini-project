import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(_request, { params }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { roomId } = await params;
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 404 }
      );
    }

    if (membership.role === "HOST") {
      return NextResponse.json(
        { error: "The host cannot leave the room. End the room instead." },
        { status: 403 }
      );
    }

    await prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "You left the room successfully.",
    });
  } catch (error) {
    console.error("Leave Room Error:", error);

    return NextResponse.json(
      { error: "Failed to leave room" },
      { status: 500 }
    );
  }
}
