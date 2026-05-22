const express = require("express");
const controller = require("./users.controller");
const {
  requireAuth,
  authorizeRoles,
  authorizeAnyPermission
} = require("../../common/middlewares/auth.middleware");
const { PERMISSIONS } = require("../../common/auth/rbac");

const router = express.Router();

router.get("/", requireAuth, authorizeRoles("admin", "manager"), controller.listUsers);
router.get(
  "/deletion-requests",
  requireAuth,
  authorizeRoles("admin", "manager"),
  controller.listDeletionRequests
);
router.post(
  "/:id/deletion-warning",
  requireAuth,
  authorizeRoles("admin", "manager"),
  controller.sendDeletionWarning
);
router.patch(
  "/deletion-requests/:id",
  requireAuth,
  authorizeRoles("admin"),
  controller.reviewDeletionRequest
);
router.get(
  "/:id/settings",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.getUserSettings
);
router.patch(
  "/:id/settings/account",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.updateAccountSettings
);
router.patch(
  "/:id/settings/privacy",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.updatePrivacySettings
);
router.patch(
  "/:id/settings/notifications",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.updateNotificationSettings
);
router.post(
  "/:id/deletion-request",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.requestAccountDeletion
);
router.get("/:id", requireAuth, controller.getUserById);
router.post(
  "/:id/media",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.uploadUserProfileMedia
);
router.patch(
  "/:id",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_UPDATE_SELF),
  controller.updateUser
);
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  controller.deleteUser
);

module.exports = router;
