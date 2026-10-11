import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "./env.js";

/**
 * Images live in a private S3 bucket (or in memory for tests and local runs).
 * The browser never sees bucket URLs: every image is served through
 * /api/media/..., which checks who is asking.
 */
function s3Driver({ bucket, region, accessKeyId, secretAccessKey }) {
  const s3 = new S3Client({ region, credentials: accessKeyId ? { accessKeyId, secretAccessKey } : undefined });
  return {
    kind: "s3",
    async put(key, body, contentType) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async remove(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async get(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { body: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType };
      } catch (error) {
        // Without s3:ListBucket, S3 answers a missing key with 403 instead of 404.
        const status = error?.$metadata?.httpStatusCode;
        if (error instanceof NoSuchKey || error?.name === "NoSuchKey" || status === 404 || status === 403) return null;
        throw error;
      }
    },
  };
}

function memoryDriver() {
  const files = new Map();
  return {
    kind: "memory",
    files,
    async put(key, body, contentType) {
      files.set(key, { body, contentType });
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async remove(key) {
      files.delete(key);
    },
  };
}

export const storage = env.s3.enabled ? s3Driver(env.s3) : memoryDriver();
if (storage.kind === "memory" && !env.isTest) {
  console.warn("[storage] S3 is not configured: images are kept in memory and lost on restart");
}

export const imagesEnabled = true;

/** The folders images can live in; the media route authorises by folder. */
export const MEDIA_FOLDERS = ["avatars", "groups", "messages"];

/**
 * Decode a data URL, re-encode it as WebP (max 1280px, EXIF and location data
 * stripped), store it under folder/ownerId, and return its /api/media path.
 * Re-encoding also proves the bytes really are an image.
 */
export async function uploadImage(dataUrl, folder, ownerId) {
  if (!MEDIA_FOLDERS.includes(folder)) throw new Error(`Unknown media folder ${folder}`);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  let webp;
  try {
    webp = await sharp(Buffer.from(base64, "base64"), { animated: true, limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (cause) {
    const error = new Error("That file is not a supported image");
    error.statusCode = 400;
    error.cause = cause;
    throw error;
  }
  const key = `${folder}/${ownerId}/${randomUUID()}.webp`;
  await storage.put(key, webp, "image/webp");
  return `/api/media/${key}`;
}

/** Delete an image given its /api/media path. Never throws: a stray file is not worth failing a request over. */
export async function removeImage(mediaPath) {
  if (typeof mediaPath !== "string" || !mediaPath.startsWith("/api/media/")) return;
  try {
    await storage.remove(mediaPath.slice("/api/media/".length));
  } catch (error) {
    console.error("[storage] could not delete", mediaPath, error.message);
  }
}
