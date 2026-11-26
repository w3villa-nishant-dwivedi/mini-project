import prisma from "@/lib/prisma";

export function isRoomExpired(room, now = Date.now()) {
  const expiresAt =
    room.createdAt.getTime() + room.maxDurationHours * 60 * 60 * 1000;
  return room.status !== "ENDED" && now >= expiresAt;
}

export async function expireRoomIfNeeded(room) {
  if (!isRoomExpired(room)) return false;

  await prisma.room.updateMany({
    where: { id: room.id, status: { not: "ENDED" } },
    data: { status: "ENDED", playbackIsPlaying: false },
  });
  return true;
}

export async function getRoomAccess(roomId, clerkId) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return { error: "User profile not found", status: 404 };
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return { error: "Room not found", status: 404 };
  }

  if (await expireRoomIfNeeded(room)) {
    return { error: "This room has reached its time limit", status: 410 };
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
    return { error: "You are not a member of this room", status: 403 };
  }

  if (room.status === "ENDED") {
    return { error: "This room has ended", status: 410 };
  }

  return { user, room, membership };
}
