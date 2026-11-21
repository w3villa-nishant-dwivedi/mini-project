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

export async function GET(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const access = await getRoomAccess(roomId, userId);
    if (access.error) return accessError(access);

    const searchParams = new URL(request.url).searchParams;
    const after = searchParams.get("after");
    const afterId = searchParams.get("afterId");
    let where = { roomId };

    if (after) {
      const afterDate = new Date(after);
      if (Number.isNaN(afterDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid chat cursor" },
          { status: 400 }
        );
      }

      where = {
        roomId,
        OR: afterId
          ? [
              { createdAt: { gt: afterDate } },
              { createdAt: afterDate, id: { gt: afterId } },
            ]
          : [{ createdAt: { gt: afterDate } }],
      };
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: after
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      messages: after ? messages : messages.reverse(),
    });
  } catch (error) {
    console.error("Get room chat error:", error);
    return NextResponse.json(
      { error: "Failed to load room chat" },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const access = await getRoomAccess(roomId, userId);
    if (access.error) return accessError(access);

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content || content.length > 1000) {
      return NextResponse.json(
        { error: "Message must be between 1 and 1000 characters" },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        roomId,
        userId: access.user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Send room chat message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
