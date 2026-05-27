const AppError = require("../../common/AppError");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const env = require("../../config/env");
const {
  hashToken,
  getTokenExpiryDate,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken
} = require("../../common/auth/tokens");
const { ROLES, USER_MODES, normalizeRole, normalizeUserMode } = require("../../common/auth/rbac");

const PRIVILEGED_ROLES = new Set([ROLES.ADMIN, ROLES.MANAGER]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function normalizeUsername(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");

  return normalized || null;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toPublicUser(user) {
  const role = normalizeRole(user.role?.name || ROLES.USER);
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

async function ensureRole(roleName) {
  return prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName }
  });
}

function isBootstrapAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return !!normalizedEmail && (env.bootstrapAdminEmails || []).includes(normalizedEmail);
}

async function promoteUserToBootstrapAdmin(user) {
  if (!user || !isBootstrapAdminEmail(user.email)) {
    return user;
  }

  if (normalizeRole(user.role?.name || ROLES.USER) === ROLES.ADMIN) {
    return user;
  }

  const adminRole = await ensureRole(ROLES.ADMIN);
  return prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      roleId: adminRole.id
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
}

function buildSessionResponse(user, accessToken, refreshToken) {
  return {
    tokenType: "Bearer",
    accessToken,
    refreshToken,
    expiresIn: env.jwtAccessExpiresIn,
    user: toPublicUser(user)
  };
}

function buildRefreshTokenRecord(user) {
  const tokenId = crypto.randomUUID();
  const refreshToken = createRefreshToken(user, tokenId);

  return {
    tokenId,
    refreshToken,
    tokenHash: hashToken(refreshToken),
    expiresAt: getTokenExpiryDate(refreshToken)
  };
}

async function createSession(tx, user) {
  const accessToken = createAccessToken(user);
  const refresh = buildRefreshTokenRecord(user);

  await tx.refreshToken.create({
    data: {
      id: refresh.tokenId,
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt
    }
  });

  return buildSessionResponse(user, accessToken, refresh.refreshToken);
}

async function signup(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const requestedRole = normalizeRole(payload.role || ROLES.USER);
  const roleName = isBootstrapAdminEmail(email)
    ? ROLES.ADMIN
    : (PRIVILEGED_ROLES.has(requestedRole) ? ROLES.USER : requestedRole);
  const requestedMode = normalizeUserMode(payload.mode || payload.userMode || USER_MODES.READER);
  const mode = roleName === ROLES.USER ? requestedMode : USER_MODES.READER;
  const username = normalizeUsername(payload.username);
  const displayName = normalizeOptionalText(payload.displayName);
  const bio = String(payload.bio || "").trim();
  const avatarColor = normalizeOptionalText(payload.avatarColor) || "#7C7CFF";
  const avatarUrl = normalizeOptionalText(payload.avatarUrl);
  const coverPhotoUrl = normalizeOptionalText(payload.coverPhotoUrl);
  const socialYouTube = payload.socialYouTube !== undefined
    ? payload.socialYouTube
    : payload.socials?.youtube !== undefined
      ? payload.socials.youtube
      : payload.website;
  const website = normalizeOptionalText(socialYouTube);
  const socialX = normalizeOptionalText(payload.socialX || payload.socials?.x);
  const socialInstagram = normalizeOptionalText(payload.socialInstagram || payload.socials?.instagram);

  if (!email || !password) {
    throw new AppError(400, "Email and password are required.");
  }
  if (password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existingUser) {
    throw new AppError(409, "User already exists with this email.");
  }

  const role = await ensureRole(roleName);
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        roleId: role.id,
        mode: mode.toUpperCase(),
        displayName,
        username,
        bio,
        avatarColor,
        avatarUrl,
        coverPhotoUrl,
        website,
        socialX,
        socialInstagram
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

    return createSession(tx, user);
  });
}

async function login(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");

  if (!email || !password) {
    throw new AppError(400, "Email and password are required.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
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

  if (!user) {
    throw new AppError(401, "Invalid email or password.");
  }

  if (user.blocked) {
    throw new AppError(403, "Your account is blocked.");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new AppError(401, "Invalid email or password.");
  }

  const effectiveUser = await promoteUserToBootstrapAdmin(user);
  return createSession(prisma, effectiveUser);
}

async function refresh(payload) {
  const token = String(payload.refreshToken || "").trim();
  if (!token) {
    throw new AppError(400, "refreshToken is required.");
  }

  const decoded = verifyRefreshToken(token);
  if (decoded.typ !== "refresh" || !decoded.jti || !decoded.sub) {
    throw new AppError(401, "Invalid refresh token.");
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const storedToken = await tx.refreshToken.findUnique({
      where: {
        id: String(decoded.jti)
      },
      include: {
        user: {
          include: {
            role: true,
            _count: {
              select: {
                followers: true,
                following: true
              }
            }
          }
        }
      }
    });

    if (
      !storedToken ||
      storedToken.userId !== decoded.sub ||
      storedToken.tokenHash !== tokenHash ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= now
    ) {
      throw new AppError(401, "Refresh token is invalid or expired.");
    }

    if (storedToken.user.blocked) {
      throw new AppError(403, "Your account is blocked.");
    }

    const nextRefresh = buildRefreshTokenRecord(storedToken.user);
    const accessToken = createAccessToken(storedToken.user);

    await tx.refreshToken.update({
      where: {
        id: storedToken.id
      },
      data: {
        revokedAt: now,
        replacedBy: nextRefresh.tokenId
      }
    });

    await tx.refreshToken.create({
      data: {
        id: nextRefresh.tokenId,
        userId: storedToken.userId,
        tokenHash: nextRefresh.tokenHash,
        expiresAt: nextRefresh.expiresAt
      }
    });

    return buildSessionResponse(storedToken.user, accessToken, nextRefresh.refreshToken);
  });
}

async function changePassword(payload, actor) {
  const currentUserId = String(actor?.userId || "").trim();
  const currentPassword = String(payload.currentPassword || "");
  const nextPassword = String(payload.newPassword || "");
  const confirmPassword = String(payload.confirmPassword || "");

  if (!currentUserId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!currentPassword || !nextPassword || !confirmPassword) {
    throw new AppError(400, "Current password, new password, and confirmation are required.");
  }

  if (nextPassword.length < 8) {
    throw new AppError(400, "New password must be at least 8 characters.");
  }

  if (nextPassword !== confirmPassword) {
    throw new AppError(400, "New password and confirmation do not match.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: currentUserId
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

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    throw new AppError(401, "Current password is incorrect.");
  }

  const sameAsCurrent = await bcrypt.compare(nextPassword, user.password);
  if (sameAsCurrent) {
    throw new AppError(400, "New password must be different from your current password.");
  }

  const passwordHash = await bcrypt.hash(nextPassword, env.bcryptSaltRounds);

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: {
        id: currentUserId
      },
      data: {
        password: passwordHash
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

    await tx.refreshToken.deleteMany({
      where: {
        userId: currentUserId
      }
    });

    return createSession(tx, updatedUser);
  });
}

async function logout(payload) {
  const token = String(payload.refreshToken || "").trim();
  if (!token) {
    throw new AppError(400, "refreshToken is required.");
  }

  const decoded = verifyRefreshToken(token);
  if (decoded.typ !== "refresh" || !decoded.jti || !decoded.sub) {
    throw new AppError(401, "Invalid refresh token.");
  }

  const now = new Date();
  const tokenHash = hashToken(token);

  await prisma.refreshToken.updateMany({
    where: {
      id: String(decoded.jti),
      userId: String(decoded.sub),
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: now
    }
  });

  return {
    loggedOut: true
  };
}

module.exports = {
  signup,
  login,
  refresh,
  changePassword,
  logout
};
