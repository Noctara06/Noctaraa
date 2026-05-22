const express = require("express");
const healthRoutes = require("../modules/health/health.routes");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/users.routes");
const storyRoutes = require("../modules/stories/stories.routes");
const reportRoutes = require("../modules/reports/reports.routes");
const readerRoutes = require("../modules/reader/reader.routes");
const notificationRoutes = require("../modules/notifications/notifications.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Midnight API is running.",
    endpoints: {
      health: "/api/v1/health",
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      stories: "/api/v1/stories",
      reports: "/api/v1/reports",
      reader: "/api/v1/reader",
      notifications: "/api/v1/notifications"
    }
  });
});

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/stories", storyRoutes);
router.use("/reports", reportRoutes);
router.use("/reader", readerRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;
