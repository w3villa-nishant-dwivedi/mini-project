import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRoomAccess } from "@/lib/roomAccess";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

function formatMessages(messages, currentUserId) {
  return messages.map((message) => {
    const counts = new Map();
    for (const reaction of message.reactions || []) {
      const current = counts.get(reaction.emoji) || { count: 0, reacted: false };
      current.count += 1;
      if (reaction.userId === currentUserId) current.reacted = true;
      counts.set(reaction.emoji, current);
    }

    const { reactions, ...messageData } = message;
    return {
      ...messageData,
      reactions: [...counts.entries()].map(([emoji, value]) => ({
        emoji,
        ...value,
      })),
    };
  });
}

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
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
      },
      orderBy: after
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      messages: formatMessages(after ? messages : messages.reverse(), access.user.id),
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
    if (body.messageId && typeof body.emoji === "string") {
      if (!REACTION_EMOJIS.includes(body.emoji)) {
        return NextResponse.json(
          { error: "Invalid reaction" },
          { status: 400 }
        );
      }

      const message = await prisma.message.findFirst({
        where: { id: body.messageId, roomId },
        select: { id: true },
      });
      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 }
        );
      }

      const existing = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId: message.id,
            userId: access.user.id,
            emoji: body.emoji,
          },
        },
      });

      if (existing) {
        await prisma.messageReaction.delete({
          where: { id: existing.id },
        });
      } else {
        await prisma.messageReaction.create({
          data: {
            messageId: message.id,
            userId: access.user.id,
            emoji: body.emoji,
          },
        });
      }

      const updatedMessage = await prisma.message.findUnique({
        where: { id: message.id },
        include: {
          user: {
            select: { id: true, name: true },
          },
          reactions: {
            select: { emoji: true, userId: true },
          },
        },
      });

      return NextResponse.json({
        message: formatMessages([updatedMessage], access.user.id)[0],
      });
    }

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
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
      },
    });

    return NextResponse.json(
      { message: formatMessages([message], access.user.id)[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Send room chat message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
