const AppError = require("../AppError");
const { verifyAccessToken } = require("../auth/tokens");
const prisma = require("../../config/prisma");
const {
  normalizeRole,
  normalizeUserMode,
  getPermissionsForRole,
  hasPermission
} = require("../auth/rbac");

function extractBearerToken(req) {
  const value = req.headers.authorization;
  if (!value) {
    return "";
  }

  const [scheme, token] = value.split(" ");
  if (String(scheme || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token;
}

async function hydrateAuthContext(token) {
  const payload = verifyAccessToken(token);
  if (payload.typ !== "access") {
    throw new AppError(401, "Invalid access token.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: String(payload.sub)
    },
    include: {
      role: true
    }
  });

  if (!user) {
    throw new AppError(401, "Authenticated user no longer exists.");
  }

  if (user.blocked) {
    throw new AppError(403, "Your account is blocked.");
  }

  const role = normalizeRole(user.role?.name || payload.role || "user");
  const mode = normalizeUserMode(user.mode || payload.mode || "reader");

  return {
    userId: user.id,
    email: user.email,
    role,
    mode,
    permissions: getPermissionsForRole(role, mode),
    tokenType: payload.typ,
    displayName: user.displayName || null,
    username: user.username || null
  };
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(401, "Authorization token is required.");
    }

    req.auth = await hydrateAuthContext(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function attachAuthIfPresent(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      req.auth = null;
      return next();
    }

    req.auth = await hydrateAuthContext(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

function authorizeRoles(...roles) {
  const allowed = new Set(
    roles
      .map((role) => String(role || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return (req, res, next) => {
    try {
      if (!req.auth?.userId) {
        throw new AppError(401, "Unauthorized.");
      }

      if (!allowed.has(req.auth.role)) {
        throw new AppError(403, "You do not have permission for this action.");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function authorizePermissions(...requiredPermissions) {
  const required = requiredPermissions.map((entry) => String(entry).trim()).filter(Boolean);

  return (req, res, next) => {
    try {
      if (!req.auth?.userId) {
        throw new AppError(401, "Unauthorized.");
      }

      const allowed = required.every((permission) => hasPermission(req.auth.permissions, permission));
      if (!allowed) {
        throw new AppError(403, "Missing required permission.");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function authorizeAnyPermission(...candidatePermissions) {
  const required = candidatePermissions.map((entry) => String(entry).trim()).filter(Boolean);

  return (req, res, next) => {
    try {
      if (!req.auth?.userId) {
        throw new AppError(401, "Unauthorized.");
      }

      const hasAny = required.some((permission) => hasPermission(req.auth.permissions, permission));
      if (!hasAny) {
        throw new AppError(403, "Missing required permission.");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function authorizeUserMode(...modes) {
  const allowedModes = new Set(
    modes
      .map((mode) => String(mode || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return (req, res, next) => {
    try {
      if (!req.auth?.userId) {
        throw new AppError(401, "Unauthorized.");
      }

      if (!allowedModes.has(req.auth.mode)) {
        throw new AppError(403, "This route is not allowed for your user mode.");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requireAuth,
  attachAuthIfPresent,
  authorizeRoles,
  authorizePermissions,
  authorizeAnyPermission,
  authorizeUserMode
};
