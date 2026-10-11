import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import { env } from "./lib/env.js";
import { imagesEnabled } from "./lib/cloudinary.js";
import authRoutes from "./routes/auth.route.js";
import conversationRoutes from "./routes/conversation.route.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

/**
 * Builds the Express app without starting it, so the test suite can drive it
 * through supertest with no port and no socket server.
 */
export function createApp({ rateLimit = true } = {}) {
  const app = express();

  // Behind Render/Railway/Fly the client IP arrives in X-Forwarded-For.
  // Without this the rate limiter sees one proxy IP for everybody.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction
        ? {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              // Profile pictures are arbitrary HTTPS URLs (Cloudinary uploads,
              // or whatever a seeded account points at), so allow https images
              // while still blocking plain-http and inline script.
              "img-src": ["'self'", "data:", "https:"],
              "connect-src": ["'self'", "ws:", "wss:"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Images arrive as base64 inside the JSON body. Express defaults to 100 kb,
  // which silently rejected every real photo.
  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ extended: true, limit: "6mb" }));
  app.use(cookieParser());

  // In production the API and the app share one origin, so CORS is only needed
  // for the Vite dev server. The old hardcoded localhost origin broke every
  // deploy.
  if (!env.isProduction) {
    app.use(cors({ origin: env.clientOrigins, credentials: true }));
  }

  app.get("/api/health", (req, res) => {
    const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
    res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      database: dbStates[mongoose.connection.readyState] ?? "unknown",
      imageUpload: imagesEnabled ? "enabled" : "disabled",
    });
  });

  // Tests exercise the same endpoint hundreds of times; the limiter would
  // turn that into a wall of 429s rather than a real result.
  if (rateLimit) app.use("/api", apiLimiter);

  app.use("/api/auth", authRoutes);
  app.use("/api/conversations", conversationRoutes);

  // An unknown /api path is a 404 in JSON, not the SPA's index.html.
  app.use("/api", notFound);

  if (env.isProduction) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res) => res.sendFile(path.join(frontendDist, "index.html")));
  }

  app.use(errorHandler);

  return app;
}
