const AppError = require("../../common/AppError");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const prisma = require("../../config/prisma");
const env = require("../../config/env");
const {
  normalizeProfileVisibility,
  normalizeFollowPermission,
  normalizeCommentPermission,
  normalizeReadingActivityVisibility,
  toPublicPrivacySettings,
  toPublicNotificationPreferences,
  canViewProfileByPrivacy
} = require("../../common/user-settings");
const {
  ROLES,
  normalizeRole,
  normalizeUserMode,
  USER_MODES
} = require("../../common/auth/rbac");

const DELETION_REQUEST_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

const REVIEW_ACTIONS = Object.freeze({
  APPROVE: "approve",
  REJECT: "reject"
});

const deletionRequestInclude = {
  targetUser: {
    include: {
      role: true
    }
  },
  requestedByUser: {
    include: {
      role: true
    }
  },
  reviewedByUser: {
    include: {
      role: true
    }
  }
};

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function normalizeActor(actor) {
  return {
    userId: String(actor?.userId || "").trim(),
    role: String(actor?.role || "").trim().toLowerCase(),
    email: String(actor?.email || "").trim().toLowerCase()
  };
}

function normalizeUsername(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");

  return normalized || null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeMediaKind(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!["avatar", "cover"].includes(normalized)) {
    throw new AppError(400, "Media kind must be avatar or cover.");
  }

  return normalized;
}

function normalizeDeletionReason(value) {
  const normalized = String(value || "").trim();
  if (normalized.length > 400) {
    throw new AppError(400, "Deletion reason must be 400 characters or fewer.");
  }

  return normalized;
}

function normalizeReviewAction(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!Object.values(REVIEW_ACTIONS).includes(normalized)) {
    throw new AppError(400, "Invalid review action. Use approve or reject.");
  }

  return normalized;
}

function toPublicUser(user) {
  const role = normalizeRole(user.role?.name || "user");
  const mode = normalizeUserMode(user.mode || USER_MODES.READER);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || null,
    username: user.username || null,
    bio: user.bio || "",
    avatarColor: user.avatarColor || "#7C7CFF",
    avatarUrl: user.avatarUrl || null,
    coverPhotoUrl: user.coverPhotoUrl || null,
    blocked: !!user.blocked,
    role,
    mode,
    website: user.website || null,
    socials: {
      x: user.socialX || "",
      instagram: user.socialInstagram || "",
      youtube: user.website || ""
    },
    followersCount: Number(user._count?.followers || 0),
    followingCount: Number(user._count?.following || 0),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt)
  };
}

function toPublicDeletionActor(user, fallbackEmail = null) {
  if (!user && !fallbackEmail) {
    return null;
  }

  return {
    id: user?.id || null,
    email: user?.email || fallbackEmail || null,
    displayName: user?.displayName || null,
    username: user?.username || null,
    role: user ? normalizeRole(user.role?.name || ROLES.USER) : null,
    blocked: user ? !!user.blocked : false
  };
}

function toPublicDeletionRequest(request) {
  return {
    id: request.id,
    status: String(request.status || DELETION_REQUEST_STATUS.PENDING).trim().toLowerCase(),
    reason: request.reason || "",
    targetUserId: request.targetUserId || null,
    requestedByUserId: request.requestedByUserId || null,
    reviewedByUserId: request.reviewedByUserId || null,
    targetEmail: request.targetUser?.email || request.targetEmail || "",
    requestedByEmail: request.requestedByUser?.email || request.requestedByEmail || "",
    reviewedByEmail: request.reviewedByUser?.email || request.reviewedByEmail || "",
    warningSentAt: toIsoString(request.warningSentAt),
    createdAt: toIsoString(request.createdAt),
    updatedAt: toIsoString(request.updatedAt),
    targetUser: toPublicDeletionActor(request.targetUser, request.targetEmail),
    requestedBy: toPublicDeletionActor(request.requestedByUser, request.requestedByEmail),
    reviewedBy: toPublicDeletionActor(request.reviewedByUser, request.reviewedByEmail)
  };
}

function toPublicUserSettings(user, deletionRequest = null) {
  return {
    user: toPublicUser(user),
    account: {
      email: user.email
    },
    privacy: toPublicPrivacySettings(user),
    notifications: toPublicNotificationPreferences(user),
    deletionRequest: deletionRequest ? toPublicDeletionRequest(deletionRequest) : null
  };
}

const PROFILE_MEDIA_ROOT = path.join(__dirname, "..", "..", "..", "uploads", "profiles");
const LOCAL_MEDIA_PREFIX = "/uploads/profiles/";
const IMAGE_MIME_MAP = Object.freeze({
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
});

const settingsUserInclude = {
  role: true,
  _count: {
    select: {
      followers: true,
      following: true
    }
  }
};

function decodeProfileMediaDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new AppError(400, "Please upload a valid PNG, JPG, WEBP, or GIF image.");
  }

  const mimeType = String(match[1] || "").trim().toLowerCase();
  const extension = IMAGE_MIME_MAP[mimeType];
  if (!extension) {
    throw new AppError(400, "Unsupported image format.");
  }

  const buffer = Buffer.from(String(match[2] || "").replace(/\s+/g, ""), "base64");
  if (!buffer.length) {
    throw new AppError(400, "Uploaded image is empty.");
  }

  if (buffer.length > env.profileMediaMaxSizeBytes) {
    throw new AppError(413, "Image must be 4 MB or smaller.");
  }

  return {
    buffer,
    mimeType,
    extension
  };
}

async function deleteLocalProfileMedia(url) {
  const relativeUrl = String(url || "").trim();
  const prefixIndex = relativeUrl.indexOf(LOCAL_MEDIA_PREFIX);
  if (prefixIndex === -1) {
    return;
  }

  const filePath = path.join(__dirname, "..", "..", "..", relativeUrl.slice(prefixIndex + 1));
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function ensureRole(roleName) {
  return prisma.role.upsert({
    where: {
      name: roleName
    },
    update: {},
    create: {
      name: roleName
    }
  });
}

function ensureSelfAccess(id, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedId = String(id || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedId) {
    throw new AppError(400, "User id is required.");
  }

  if (currentActor.userId !== normalizedId) {
    throw new AppError(403, "You can update only your own account settings.");
  }

  return currentActor;
}

async function getUserForDeletion(client, userId) {
  return client.user.findUnique({
    where: {
      id: userId
    },
    include: {
      role: true
    }
  });
}

async function getDeletionRequest(client, requestId) {
  return client.userDeletionRequest.findUnique({
    where: {
      id: requestId
    },
    include: deletionRequestInclude
  });
}

async function getLatestDeletionRequestForUser(client, userId) {
  return client.userDeletionRequest.findFirst({
    where: {
      targetUserId: userId
    },
    include: deletionRequestInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function loadSettingsPayload(client, userId) {
  const [user, deletionRequest] = await Promise.all([
    client.user.findUnique({
      where: {
        id: userId
      },
      include: settingsUserInclude
    }),
    getLatestDeletionRequestForUser(client, userId)
  ]);

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  return toPublicUserSettings(user, deletionRequest);
}

async function countActiveAdminsExcluding(client, userId) {
  return client.user.count({
    where: {
      id: {
        not: userId
      },
      blocked: false,
      role: {
        name: ROLES.ADMIN
      }
    }
  });
}

async function ensureDeletionTargetAllowed(targetUser, actor, client) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!targetUser) {
    throw new AppError(404, "User not found.");
  }

  if (currentActor.userId === targetUser.id) {
    throw new AppError(403, "You cannot delete your own account.");
  }

  const targetRole = normalizeRole(targetUser.role?.name || ROLES.USER);
  if (currentActor.role === ROLES.MANAGER && targetRole === ROLES.ADMIN) {
    throw new AppError(403, "Manager cannot request deletion of an admin account.");
  }

  if (targetRole === ROLES.ADMIN) {
    const remainingAdmins = await countActiveAdminsExcluding(client, targetUser.id);
    if (remainingAdmins < 1) {
      throw new AppError(409, "You cannot delete the last active admin account.");
    }
  }

  return targetRole;
}

function buildWarningText(targetUser, actor, reason) {
  const actorEmail = actor.email || actor.userId || "A privileged user";
  const suffix = reason ? ` Reason: ${reason}` : "";

  if (actor.role === ROLES.MANAGER) {
    return `Manager ${actorEmail} requested account deletion. An admin will review the request.${suffix}`;
  }

  return `Admin ${actorEmail} warned that your account is marked for deletion.${suffix}`;
}

function buildAdminReviewText(targetUser, actor, reason) {
  const actorEmail = actor.email || actor.userId || "A manager";
  const targetEmail = targetUser.email || "this user";
  const suffix = reason ? ` Reason: ${reason}` : "";
  return `${actorEmail} requested approval to delete ${targetEmail}.${suffix}`;
}

function buildSelfDeletionRequestText(targetUser, reason) {
  const targetEmail = targetUser.email || "this user";
  const suffix = reason ? ` Reason: ${reason}` : "";
  return `${targetEmail} requested account deletion from account settings.${suffix}`;
}

function buildManagerReviewResultText(status, request, actor) {
  const adminEmail = actor.email || actor.userId || "An admin";
  const targetEmail = request.targetEmail || request.targetUser?.email || "the user";

  if (status === DELETION_REQUEST_STATUS.APPROVED) {
    return `${adminEmail} approved your deletion request for ${targetEmail}.`;
  }

  return `${adminEmail} rejected your deletion request for ${targetEmail}.`;
}

async function createNotifications(client, notifications) {
  const list = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
  if (!list.length) {
    return;
  }

  await client.notification.createMany({
    data: list
  });
}

async function listDeletionRequests(actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const where = currentActor.role === ROLES.ADMIN
    ? {}
    : {
      requestedByUserId: currentActor.userId
    };

  const requests = await prisma.userDeletionRequest.findMany({
    where,
    include: deletionRequestInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return requests.map(toPublicDeletionRequest);
}

async function sendDeletionWarning(id, payload, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (![ROLES.ADMIN, ROLES.MANAGER].includes(currentActor.role)) {
    throw new AppError(403, "Only admin or manager can start account deletion.");
  }

  const reason = normalizeDeletionReason(payload.reason);

  const requestId = await prisma.$transaction(async (tx) => {
    const targetUser = await getUserForDeletion(tx, id);
    await ensureDeletionTargetAllowed(targetUser, currentActor, tx);

    const pendingRequest = await tx.userDeletionRequest.findFirst({
      where: {
        targetUserId: id,
        status: DELETION_REQUEST_STATUS.PENDING
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (pendingRequest) {
      throw new AppError(409, "A deletion warning is already pending for this user.");
    }

    const request = await tx.userDeletionRequest.create({
      data: {
        targetUserId: targetUser.id,
        requestedByUserId: currentActor.userId,
        targetEmail: targetUser.email,
        requestedByEmail: currentActor.email || null,
        reason,
        warningSentAt: new Date()
      }
    });

    const notifications = [
      {
        userId: targetUser.id,
        actorUserId: currentActor.userId,
        type: "ACCOUNT_WARNING",
        text: buildWarningText(targetUser, currentActor, reason)
      }
    ];

    if (currentActor.role === ROLES.MANAGER) {
      const adminUsers = await tx.user.findMany({
        where: {
          blocked: false,
          role: {
            name: ROLES.ADMIN
          }
        },
        select: {
          id: true
        }
      });

      if (!adminUsers.length) {
        throw new AppError(409, "No active admin is available to review this deletion request.");
      }

      adminUsers.forEach((adminUser) => {
        notifications.push({
          userId: adminUser.id,
          actorUserId: currentActor.userId,
          type: "DELETION_REQUEST",
          text: buildAdminReviewText(targetUser, currentActor, reason)
        });
      });
    }

    await createNotifications(tx, notifications);
    return request.id;
  });

  const request = await getDeletionRequest(prisma, requestId);
  return toPublicDeletionRequest(request);
}

async function reviewDeletionRequest(id, payload, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (currentActor.role !== ROLES.ADMIN) {
    throw new AppError(403, "Only admin can review deletion requests.");
  }

  const action = normalizeReviewAction(payload.action || payload.status);

  await prisma.$transaction(async (tx) => {
    const request = await getDeletionRequest(tx, id);

    if (!request) {
      throw new AppError(404, "Deletion request not found.");
    }

    if (request.status !== DELETION_REQUEST_STATUS.PENDING) {
      throw new AppError(409, "Deletion request has already been reviewed.");
    }

    const notifications = [];
    if (request.requestedByUserId && request.requestedByUserId !== currentActor.userId) {
      notifications.push({
        userId: request.requestedByUserId,
        actorUserId: currentActor.userId,
        type: "DELETION_REQUEST",
        text: buildManagerReviewResultText(
          action === REVIEW_ACTIONS.APPROVE
            ? DELETION_REQUEST_STATUS.APPROVED
            : DELETION_REQUEST_STATUS.REJECTED,
          request,
          currentActor
        )
      });
    }

    if (action === REVIEW_ACTIONS.REJECT) {
      await tx.userDeletionRequest.update({
        where: {
          id
        },
        data: {
          status: DELETION_REQUEST_STATUS.REJECTED,
          reviewedByUserId: currentActor.userId,
          reviewedByEmail: currentActor.email || null
        }
      });

      await createNotifications(tx, notifications);
      return;
    }

    if (!request.targetUserId || !request.targetUser) {
      throw new AppError(409, "Target user no longer exists.");
    }

    await ensureDeletionTargetAllowed(request.targetUser, currentActor, tx);

    await tx.userDeletionRequest.update({
      where: {
        id
      },
      data: {
        status: DELETION_REQUEST_STATUS.APPROVED,
        reviewedByUserId: currentActor.userId,
        reviewedByEmail: currentActor.email || null
      }
    });

    await createNotifications(tx, notifications);

    await tx.user.delete({
      where: {
        id: request.targetUserId
      }
    });
  });

  const request = await getDeletionRequest(prisma, id);
  return toPublicDeletionRequest(request);
}

async function deleteUser(id, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (currentActor.role !== ROLES.ADMIN) {
    throw new AppError(403, "Only admin can delete accounts.");
  }

  const pendingRequest = await prisma.userDeletionRequest.findFirst({
    where: {
      targetUserId: id,
      status: DELETION_REQUEST_STATUS.PENDING
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!pendingRequest) {
    throw new AppError(409, "Send a deletion warning before deleting this account.");
  }

  return reviewDeletionRequest(
    pendingRequest.id,
    {
      action: REVIEW_ACTIONS.APPROVE
    },
    actor
  );
}

async function listUsers() {
  const users = await prisma.user.findMany({
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return users.map(toPublicUser);
}

async function getUserById(id, actor = {}) {
  const currentActor = normalizeActor(actor);
  const normalizedId = String(id || "").trim();
  const isPrivileged = [ROLES.ADMIN, ROLES.MANAGER].includes(currentActor.role);

  const user = await prisma.user.findUnique({
    where: { id: normalizedId },
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      },
      ...(currentActor.userId
        ? {
          followers: {
            where: {
              followerId: currentActor.userId
            },
            select: {
              id: true
            }
          }
        }
        : {})
    }
  });

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  const isSelf = currentActor.userId === user.id;
  const isFollower = Array.isArray(user.followers) && user.followers.length > 0;
  if (!canViewProfileByPrivacy(user, {
    isSelf,
    isFollower,
    isPrivileged
  })) {
    throw new AppError(403, "This profile is private.");
  }

  return toPublicUser(user);
}

async function getUserSettings(id, actor) {
  ensureSelfAccess(id, actor);
  return loadSettingsPayload(prisma, String(id || "").trim());
}

async function updateAccountSettings(id, payload, actor) {
  ensureSelfAccess(id, actor);
  const userId = String(id || "").trim();
  const nextEmail = normalizeEmail(payload.email);

  if (!nextEmail) {
    throw new AppError(400, "Email is required.");
  }

  const existing = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: settingsUserInclude
  });

  if (!existing) {
    throw new AppError(404, "User not found.");
  }

  if (nextEmail !== existing.email) {
    const taken = await prisma.user.findUnique({
      where: {
        email: nextEmail
      },
      select: {
        id: true
      }
    });

    if (taken && taken.id !== existing.id) {
      throw new AppError(409, "Another account already uses this email.");
    }
  }

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      email: nextEmail
    }
  });

  return loadSettingsPayload(prisma, userId);
}

async function updatePrivacySettings(id, payload, actor) {
  ensureSelfAccess(id, actor);
  const userId = String(id || "").trim();

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      profileVisibility: normalizeProfileVisibility(payload.profileVisibility),
      followPermission: normalizeFollowPermission(payload.followPermission),
      storyCommentPermission: normalizeCommentPermission(payload.storyCommentPermission),
      readingActivityVisibility: normalizeReadingActivityVisibility(payload.readingActivityVisibility)
    }
  });

  return loadSettingsPayload(prisma, userId);
}

async function updateNotificationSettings(id, payload, actor) {
  ensureSelfAccess(id, actor);
  const userId = String(id || "").trim();
  const data = {};

  if (payload.likes !== undefined) {
    data.notifyLikes = !!payload.likes;
  }

  if (payload.comments !== undefined) {
    data.notifyComments = !!payload.comments;
  }

  if (payload.follows !== undefined) {
    data.notifyFollows = !!payload.follows;
  }

  if (payload.storyUpdates !== undefined) {
    data.notifyStoryUpdates = !!payload.storyUpdates;
  }

  if (!Object.keys(data).length) {
    throw new AppError(400, "At least one notification preference is required.");
  }

  await prisma.user.update({
    where: {
      id: userId
    },
    data
  });

  return loadSettingsPayload(prisma, userId);
}

async function requestAccountDeletion(id, payload, actor) {
  const currentActor = ensureSelfAccess(id, actor);
  const userId = String(id || "").trim();
  const password = String(payload.password || "");
  const reason = normalizeDeletionReason(payload.reason);

  if (!password) {
    throw new AppError(400, "Password is required to request account deletion.");
  }

  const requestId = await prisma.$transaction(async (tx) => {
    const user = await getUserForDeletion(tx, userId);
    if (!user) {
      throw new AppError(404, "User not found.");
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new AppError(401, "Your password is incorrect.");
    }

    const targetRole = normalizeRole(user.role?.name || ROLES.USER);
    if (targetRole === ROLES.ADMIN) {
      const remainingAdmins = await countActiveAdminsExcluding(tx, user.id);
      if (remainingAdmins < 1) {
        throw new AppError(409, "You cannot request deletion for the last active admin account.");
      }
    }

    const pendingRequest = await tx.userDeletionRequest.findFirst({
      where: {
        targetUserId: user.id,
        status: DELETION_REQUEST_STATUS.PENDING
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (pendingRequest) {
      throw new AppError(409, "An account deletion request is already pending.");
    }

    const adminUsers = await tx.user.findMany({
      where: {
        blocked: false,
        role: {
          name: ROLES.ADMIN
        },
        id: {
          not: user.id
        }
      },
      select: {
        id: true
      }
    });

    if (!adminUsers.length) {
      throw new AppError(409, "No active admin is available to review your deletion request.");
    }

    const request = await tx.userDeletionRequest.create({
      data: {
        targetUserId: user.id,
        requestedByUserId: currentActor.userId,
        targetEmail: user.email,
        requestedByEmail: currentActor.email || user.email,
        reason
      }
    });

    await createNotifications(tx, adminUsers.map((adminUser) => ({
      userId: adminUser.id,
      actorUserId: currentActor.userId,
      type: "DELETION_REQUEST",
      text: buildSelfDeletionRequestText(user, reason)
    })));

    return request.id;
  });

  const request = await getDeletionRequest(prisma, requestId);
  return {
    request: toPublicDeletionRequest(request),
    settings: await loadSettingsPayload(prisma, userId)
  };
}

async function uploadUserProfileMedia(id, payload, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const existing = await prisma.user.findUnique({
    where: {
      id
    },
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError(404, "User not found.");
  }

  const isSelf = currentActor.userId === existing.id;
  const isAdminActor = currentActor.role === ROLES.ADMIN;
  if (!isSelf && !isAdminActor) {
    throw new AppError(403, "You can update only your own profile.");
  }

  const kind = normalizeMediaKind(payload.kind);
  const { buffer, extension } = decodeProfileMediaDataUrl(payload.dataUrl);
  const folder = path.join(PROFILE_MEDIA_ROOT, existing.id);
  const filename = `${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(folder, filename);
  const relativeUrl = `${LOCAL_MEDIA_PREFIX}${existing.id}/${filename}`;
  const field = kind === "avatar" ? "avatarUrl" : "coverPhotoUrl";
  const previousUrl = String(existing[field] || "").trim();

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(filePath, buffer);

  const updated = await prisma.user.update({
    where: {
      id
    },
    data: {
      [field]: relativeUrl
    },
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  });

  if (previousUrl && previousUrl !== relativeUrl) {
    await deleteLocalProfileMedia(previousUrl);
  }

  return {
    kind,
    user: toPublicUser(updated),
    url: relativeUrl
  };
}

async function updateUser(id, payload, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const existing = await prisma.user.findUnique({
    where: {
      id
    },
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError(404, "User not found.");
  }

  const isSelf = currentActor.userId === existing.id;
  const isAdminActor = currentActor.role === ROLES.ADMIN;

  if (!isSelf && !isAdminActor) {
    throw new AppError(403, "You can update only your own profile.");
  }

  const data = {};

  if (payload.displayName !== undefined) {
    data.displayName = normalizeOptionalText(payload.displayName);
  }

  if (payload.username !== undefined) {
    data.username = normalizeUsername(payload.username);
  }

  if (payload.bio !== undefined) {
    data.bio = String(payload.bio || "").trim();
  }

  if (payload.avatarColor !== undefined) {
    data.avatarColor = normalizeOptionalText(payload.avatarColor) || "#7C7CFF";
  }

  if (payload.avatarUrl !== undefined) {
    data.avatarUrl = normalizeOptionalText(payload.avatarUrl);
  }

  if (payload.coverPhotoUrl !== undefined) {
    data.coverPhotoUrl = normalizeOptionalText(payload.coverPhotoUrl);
  }

  if (payload.socialYouTube !== undefined || payload.socials?.youtube !== undefined || payload.website !== undefined) {
    const nextYouTube = payload.socialYouTube !== undefined
      ? payload.socialYouTube
      : payload.socials?.youtube !== undefined
        ? payload.socials.youtube
        : payload.website;
    data.website = normalizeOptionalText(nextYouTube);
  }

  if (payload.socialX !== undefined || payload.socials?.x !== undefined) {
    data.socialX = normalizeOptionalText(payload.socialX || payload.socials?.x);
  }

  if (payload.socialInstagram !== undefined || payload.socials?.instagram !== undefined) {
    data.socialInstagram = normalizeOptionalText(payload.socialInstagram || payload.socials?.instagram);
  }

  if (payload.mode !== undefined || payload.userMode !== undefined) {
    const requestedMode = normalizeUserMode(payload.mode || payload.userMode);
    const effectiveRole = payload.role !== undefined
      ? normalizeRole(payload.role)
      : normalizeRole(existing.role?.name || ROLES.USER);
    data.mode = effectiveRole === ROLES.USER
      ? requestedMode.toUpperCase()
      : USER_MODES.READER.toUpperCase();
  }

  if (payload.role !== undefined || payload.blocked !== undefined) {
    if (!isAdminActor) {
      throw new AppError(403, "Only admin can manage user role or blocked status.");
    }

    if (normalizeRole(existing.role?.name || ROLES.USER) === ROLES.ADMIN && currentActor.userId !== existing.id) {
      throw new AppError(403, "Admin accounts cannot be modified by another user.");
    }

    if (payload.role !== undefined) {
      const roleName = normalizeRole(payload.role);
      const nextRole = await ensureRole(roleName);
      data.roleId = nextRole.id;
      if (roleName !== ROLES.USER) {
        data.mode = USER_MODES.READER.toUpperCase();
      }
    }

    if (payload.blocked !== undefined) {
      data.blocked = !!payload.blocked;
    }
  }

  if (!Object.keys(data).length) {
    return toPublicUser(existing);
  }

  const updated = await prisma.user.update({
    where: {
      id
    },
    data,
    include: {
      role: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  });

  return toPublicUser(updated);
}

module.exports = {
  listUsers,
  getUserById,
  getUserSettings,
  uploadUserProfileMedia,
  updateAccountSettings,
  updatePrivacySettings,
  updateNotificationSettings,
  updateUser,
  listDeletionRequests,
  requestAccountDeletion,
  sendDeletionWarning,
  reviewDeletionRequest,
  deleteUser
};
