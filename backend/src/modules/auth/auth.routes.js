const express = require("express");
const controller = require("./auth.controller");
const { requireAuth } = require("../../common/middlewares/auth.middleware");

const router = express.Router();

router.post("/signup", controller.signup);
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/change-password", requireAuth, controller.changePassword);
router.post("/logout", controller.logout);

module.exports = router;
