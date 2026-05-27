const dotenv = require("dotenv");

dotenv.config();

const port = Number.parseInt(process.env.PORT || "5000", 10);
if (Number.isNaN(port)) {
  throw new Error("Invalid PORT in environment variables.");
}

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required in environment variables.");
}

const jwtAccessSecret = String(process.env.JWT_ACCESS_SECRET || "").trim();
if (!jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required in environment variables.");
}

const jwtRefreshSecret = String(process.env.JWT_REFRESH_SECRET || "").trim();
if (!jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET is required in environment variables.");
}

const bcryptSaltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
if (!Number.isInteger(bcryptSaltRounds) || bcryptSaltRounds < 8 || bcryptSaltRounds > 15) {
  throw new Error("BCRYPT_SALT_ROUNDS must be an integer between 8 and 15.");
}

const profileMediaMaxSizeBytes = Number.parseInt(process.env.PROFILE_MEDIA_MAX_SIZE_BYTES || `${4 * 1024 * 1024}`, 10);
if (!Number.isInteger(profileMediaMaxSizeBytes) || profileMediaMaxSizeBytes <= 0) {
  throw new Error("PROFILE_MEDIA_MAX_SIZE_BYTES must be a positive integer.");
}

const corsOriginRaw = String(process.env.CORS_ORIGIN || "*").trim();
const corsOrigins = corsOriginRaw === "*"
  ? "*"
  : corsOriginRaw
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean);

if (corsOriginRaw !== "*" && !corsOrigins.length) {
  throw new Error("CORS_ORIGIN must be '*' or a comma-separated list of allowed origins.");
}

const bootstrapAdminEmails = String(process.env.BOOTSTRAP_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port,
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  bodyLimit: process.env.BODY_LIMIT || "25mb",
  profileMediaMaxSizeBytes,
  corsOrigin: corsOriginRaw,
  corsOrigins,
  bootstrapAdminEmails,
  databaseUrl,
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  bcryptSaltRounds
});

module.exports = config;
