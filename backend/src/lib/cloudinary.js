import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

if (env.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
} else {
  console.warn("[cloudinary] keys not set — image upload is disabled");
}

export const imagesEnabled = env.cloudinary.enabled;

/**
 * Upload a base64 data URL and return the hosted URL.
 * Throws a tagged error so callers can map it to a 4xx instead of a 500.
 */
export async function uploadImage(dataUrl, folder) {
  if (!env.cloudinary.enabled) {
    const error = new Error("Image upload is not configured on this server");
    error.statusCode = 503;
    throw error;
  }

  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: "image",
      transformation: [{ width: 1280, height: 1280, crop: "limit", quality: "auto" }],
    });
    return result.secure_url;
  } catch (error) {
    const wrapped = new Error("Could not upload the image. Please try a different file.");
    wrapped.statusCode = 400;
    wrapped.cause = error;
    throw wrapped;
  }
}

export default cloudinary;
