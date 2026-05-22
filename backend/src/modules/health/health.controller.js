const prisma = require("../../config/prisma");

async function getHealth(req, res) {
  let database = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch (error) {
    database = "down";
  }

  res.status(200).json({
    success: true,
    service: "midnight-backend",
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getHealth
};
