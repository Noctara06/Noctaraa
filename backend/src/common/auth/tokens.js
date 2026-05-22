const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AppError = require("../AppError");
const env = require("../../config/env");
const { normalizeRole, normalizeUserMode, getPermissionsForRole } = require("./rbac");

const JWT_ISSUER = "midnight-backend";
const JWT_AUDIENCE = "midnight-client";
const LEGACY_JWT_ISSUER = "audio-platform-backend";
const LEGACY_JWT_AUDIENCE = "audio-platform-client";

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function getTokenExpiryDate(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    throw new AppError(500, "Failed to determine token expiry.");
  }

  return new Date(decoded.exp * 1000);
}

function createAccessToken(user) {
  const role = normalizeRole(user.role?.name || user.role || "user");
  const mode = normalizeUserMode(user.mode || "reader");
  const permissions = getPermissionsForRole(role, mode);

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role,
      mode,
      permissions,
      typ: "access"
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

function createRefreshToken(user, tokenId) {
  const role = normalizeRole(user.role?.name || user.role || "user");
  const mode = normalizeUserMode(user.mode || "reader");

  return jwt.sign(
    {
      sub: user.id,
      role,
      mode,
      typ: "refresh",
      jti: tokenId
    },
    env.jwtRefreshSecret,
    {
      expiresIn: env.jwtRefreshExpiresIn,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

function verifyTokenWithFallbacks(token, secret, errorMessage) {
  const combinations = [
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    },
    {
      issuer: LEGACY_JWT_ISSUER,
      audience: LEGACY_JWT_AUDIENCE
    }
  ];

  for (const options of combinations) {
    try {
      return jwt.verify(token, secret, options);
    } catch (error) {
      // Try the next supported issuer/audience pair.
    }
  }

  throw new AppError(401, errorMessage);
}

function verifyAccessToken(token) {
  return verifyTokenWithFallbacks(token, env.jwtAccessSecret, "Invalid or expired access token.");
}

function verifyRefreshToken(token) {
  return verifyTokenWithFallbacks(token, env.jwtRefreshSecret, "Invalid or expired refresh token.");
}

module.exports = {
  hashToken,
  getTokenExpiryDate,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
