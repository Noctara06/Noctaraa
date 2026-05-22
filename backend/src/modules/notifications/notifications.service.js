const AppError = require("../../common/AppError");
const prisma = require("../../config/prisma");

function normalizeActor(actor) {
  return {
    userId: String(actor?.userId || "").trim()
  };
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function toPublicNotification(notification) {
  return {
    id: notification.id,
    type: String(notification.type || "").trim().toLowerCase(),
    text: notification.text,
    unread: !notification.readAt,
    readAt: toIsoString(notification.readAt),
    createdAt: toIsoString(notification.createdAt),
    updatedAt: toIsoString(notification.updatedAt),
    actor: notification.actorUser ? {
      id: notification.actorUser.id,
      email: notification.actorUser.email,
      displayName: notification.actorUser.displayName || null,
      username: notification.actorUser.username || null,
      avatarColor: notification.actorUser.avatarColor || "#7C7CFF"
    } : null,
    story: notification.story ? {
      id: notification.story.id,
      title: notification.story.title
    } : null
  };
}

async function listNotifications(actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: currentActor.userId
    },
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          avatarColor: true
        }
      },
      story: {
        select: {
          id: true,
          title: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return notifications.map(toPublicNotification);
}

async function markAllRead(actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const now = new Date();
  await prisma.notification.updateMany({
    where: {
      userId: currentActor.userId,
      readAt: null
    },
    data: {
      readAt: now
    }
  });

  return listNotifications(actor);
}

module.exports = {
  listNotifications,
  markAllRead
};
