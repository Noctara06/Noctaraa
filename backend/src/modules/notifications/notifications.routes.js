const express = require("express");
const controller = require("./notifications.controller");
const {
  requireAuth
} = require("../../common/middlewares/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, controller.listNotifications);
router.post("/read-all", requireAuth, controller.markAllRead);

module.exports = router;
