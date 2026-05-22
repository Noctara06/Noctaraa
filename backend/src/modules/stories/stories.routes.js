const express = require("express");
const controller = require("./stories.controller");
const {
  attachAuthIfPresent,
  requireAuth,
  authorizePermissions,
  authorizeAnyPermission
} = require("../../common/middlewares/auth.middleware");
const { PERMISSIONS } = require("../../common/auth/rbac");

const router = express.Router();

router.get("/", attachAuthIfPresent, controller.listStories);
router.get("/:id", attachAuthIfPresent, controller.getStoryById);
router.post("/", requireAuth, authorizePermissions(PERMISSIONS.STORIES_CREATE), controller.createStory);
router.patch(
  "/:id",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.STORIES_UPDATE_ANY, PERMISSIONS.STORIES_UPDATE_OWN),
  controller.updateStory
);
router.delete(
  "/:id",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.STORIES_DELETE_ANY, PERMISSIONS.STORIES_DELETE_OWN),
  controller.deleteStory
);

module.exports = router;
