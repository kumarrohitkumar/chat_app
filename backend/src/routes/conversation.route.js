import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { messageLimiter } from "../middleware/rateLimit.middleware.js";
import {
  addMembers,
  getContacts,
  getMessages,
  listConversations,
  markRead,
  openDirect,
  removeMember,
  renameGroup,
  sendMessage,
  startGroup,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/contacts", getContacts);

router.get("/", listConversations);
router.post("/direct", openDirect);
router.post("/group", startGroup);

router.get("/:id/messages", getMessages);
router.post("/:id/messages", messageLimiter, sendMessage);
router.post("/:id/read", markRead);

router.patch("/:id", renameGroup);
router.post("/:id/members", addMembers);
router.delete("/:id/members/:userId", removeMember);

export default router;
