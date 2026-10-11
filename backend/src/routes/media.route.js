import express from "express";
import mongoose from "mongoose";
import { MEDIA_FOLDERS, storage } from "../lib/storage.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireMembership } from "../services/conversation.service.js";

const router = express.Router();

/**
 * GET /api/media/:folder/:ownerId/:file
 * Avatars are visible to anyone signed in; group and message images only to
 * members of that conversation. Anything else is a plain 404.
 */
router.get("/:folder/:ownerId/:file", protectRoute, async (req, res, next) => {
  try {
    const { folder, ownerId, file } = req.params;
    const valid = MEDIA_FOLDERS.includes(folder) && mongoose.isValidObjectId(ownerId) && /^[\w-]{1,64}\.webp$/.test(file);
    if (!valid) return res.status(404).json({ message: "Not found" });

    if (folder !== "avatars") {
      try {
        await requireMembership(ownerId, req.user._id);
      } catch {
        return res.status(404).json({ message: "Not found" });
      }
    }

    const found = await storage.get(`${folder}/${ownerId}/${file}`);
    if (!found) return res.status(404).json({ message: "Not found" });

    // Keys are random and never reused, so the browser may keep a private copy for good.
    res.set({
      "Content-Type": found.contentType || "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(found.body);
  } catch (error) {
    next(error);
  }
});

export default router;
