const http = require("http");
const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(
    `[server] Midnight backend running on http://localhost:${env.port}${env.apiPrefix}`
  );
});

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
