import http from "http";

import { env } from "./lib/env.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import { createApp } from "./app.js";
import { initSocket, closeSocket } from "./lib/socket.js";

const app = createApp();
const server = http.createServer(app);

initSocket(server);

async function start() {
  // Connect first: a server that listens without a database just fails every
  // request with a confusing error.
  await connectDB();

  server.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
  });
}

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down`);

  const force = setTimeout(() => {
    console.error("[server] forced exit after 10s");
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close();
  await closeSocket().catch(() => {});
  await disconnectDB().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  console.error("[server] failed to start:", error.message);
  process.exit(1);
});
