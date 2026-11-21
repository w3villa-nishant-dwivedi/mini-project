import prisma from "@/lib/prisma";

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
