const http = require("http");
const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");
const { bootstrapAdminUsers } = require("./bootstrap/admin-bootstrap");

const server = http.createServer(app);

async function startServer() {
  try {
    await bootstrapAdminUsers();
    server.listen(env.port, () => {
      console.log(
        `[server] Midnight backend running on http://localhost:${env.port}${env.apiPrefix}`
      );
    });
  } catch (error) {
    console.error("[server] Startup error:", error);
    await prisma.disconnect();
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[server] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    await prisma.disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("[server] Shutdown error:", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("[server] Shutdown error:", error);
    process.exit(1);
  });
});

startServer().catch((error) => {
  console.error("[server] Failed to start:", error);
  process.exit(1);
});
