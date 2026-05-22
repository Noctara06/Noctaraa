const AppError = require("../AppError");

const ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user"
});

const USER_MODES = Object.freeze({
  WRITER: "writer",
  READER: "reader"
});

const PERMISSIONS = Object.freeze({
  USERS_READ_ALL: "users:read:all",
  USERS_READ_SELF: "users:read:self",
  USERS_UPDATE_SELF: "users:update:self",
  USERS_MANAGE: "users:manage",
  USERS_ROLE_ASSIGN: "users:role:assign",
  STORIES_READ: "stories:read",
  STORIES_CREATE: "stories:create",
  STORIES_UPDATE_ANY: "stories:update:any",
  STORIES_UPDATE_OWN: "stories:update:own",
  STORIES_DELETE_ANY: "stories:delete:any",
  STORIES_DELETE_OWN: "stories:delete:own",
  ANALYTICS_READ: "analytics:read",
  REPORTS_CREATE: "reports:create",
  REPORTS_READ: "reports:read",
  REPORTS_MANAGE: "reports:manage"
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

function normalizeRole(role, fallback = ROLES.USER) {
  const value = String(role || fallback).trim().toLowerCase();
  if (!Object.values(ROLES).includes(value)) {
    throw new AppError(400, `Invalid role. Use ${Object.values(ROLES).join("/")}.`);
  }
  return value;
}

function normalizeUserMode(mode, fallback = USER_MODES.READER) {
  const value = String(mode || fallback).trim().toLowerCase();
  if (!Object.values(USER_MODES).includes(value)) {
    throw new AppError(400, `Invalid user mode. Use ${Object.values(USER_MODES).join("/")}.`);
  }
  return value;
}

function getPermissionsForRole(role, mode) {
  const normalizedRole = normalizeRole(role);
  const normalizedMode = normalizeUserMode(mode);

  if (normalizedRole === ROLES.ADMIN) {
    return [...ALL_PERMISSIONS];
  }

  if (normalizedRole === ROLES.MANAGER) {
    return [
      PERMISSIONS.USERS_READ_ALL,
      PERMISSIONS.USERS_UPDATE_SELF,
      PERMISSIONS.STORIES_READ,
      PERMISSIONS.STORIES_CREATE,
      PERMISSIONS.STORIES_UPDATE_ANY,
      PERMISSIONS.STORIES_DELETE_ANY,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_MANAGE
    ];
  }

  const baseUserPermissions = [
    PERMISSIONS.USERS_READ_SELF,
    PERMISSIONS.USERS_UPDATE_SELF,
    PERMISSIONS.STORIES_READ,
    PERMISSIONS.REPORTS_CREATE
  ];

  if (normalizedMode === USER_MODES.WRITER) {
    baseUserPermissions.push(
      PERMISSIONS.STORIES_CREATE,
      PERMISSIONS.STORIES_UPDATE_OWN,
      PERMISSIONS.STORIES_DELETE_OWN
    );
  }

  return baseUserPermissions;
}

function hasPermission(permissions, permission) {
  if (!Array.isArray(permissions)) {
    return false;
  }
  return permissions.includes(permission);
}

module.exports = {
  ROLES,
  USER_MODES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  normalizeRole,
  normalizeUserMode,
  getPermissionsForRole,
  hasPermission
};
