import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Connect before the server starts accepting traffic. The previous version
 * logged the error and carried on, so the app would listen happily while every
 * request failed — the worst kind of outage to debug.
 */
export async function connectDB() {
  mongoose.set("strictQuery", true);

  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`[db] connected to ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[db] connection failed: ${error.message}`);
    throw error;
  }

  mongoose.connection.on("disconnected", () => console.warn("[db] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[db] reconnected"));
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
