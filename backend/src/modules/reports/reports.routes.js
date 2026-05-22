const express = require("express");
const controller = require("./reports.controller");
const {
  requireAuth,
  authorizePermissions,
  authorizeAnyPermission
} = require("../../common/middlewares/auth.middleware");
const { PERMISSIONS } = require("../../common/auth/rbac");

const router = express.Router();

router.post("/", requireAuth, authorizePermissions(PERMISSIONS.REPORTS_CREATE), controller.createReport);
router.get(
  "/",
  requireAuth,
  authorizeAnyPermission(PERMISSIONS.REPORTS_READ, PERMISSIONS.REPORTS_MANAGE),
  controller.listReports
);
router.patch("/:id", requireAuth, authorizePermissions(PERMISSIONS.REPORTS_MANAGE), controller.updateReport);
router.delete("/:id", requireAuth, authorizePermissions(PERMISSIONS.REPORTS_MANAGE), controller.deleteReport);

module.exports = router;
