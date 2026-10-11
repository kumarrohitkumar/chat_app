import dotenv from "dotenv";

dotenv.config();

/**
 * Read the environment once, validate it, and fail loudly at boot rather than
 * at the first request. A deploy that is missing a secret should refuse to
 * start — not start and then 500 on every login.
 */
function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(
      `\nMissing required environment variable: ${name}\n` +
        `Copy backend/.env.example to backend/.env and fill it in.\n`
    );
    process.exit(1);
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const jwtSecret = required("JWT_SECRET");
if (isProduction && jwtSecret.length < 32) {
  console.error("\nJWT_SECRET is too short for production. Use at least 32 characters.\n");
  process.exit(1);
}

/**
 * In production the API and the built frontend are served from one origin, so
 * no cross-origin list is needed. In development Vite runs on its own port.
 */
const clientOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || "",
  apiKey: process.env.CLOUDINARY_API_KEY?.trim() || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || "",
};

/** Images are optional. Without these keys the app runs, minus image upload. */
cloudinary.enabled = Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 5001,
  mongoUri: required("MONGO_URI"),
  jwtSecret,
  clientOrigins,
  cloudinary,
};
