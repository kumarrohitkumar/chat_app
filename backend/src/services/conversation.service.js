import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { ValidationError } from "../lib/validate.js";

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
  }
}

export function toObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw new ValidationError(`Invalid ${label}`);
  return new mongoose.Types.ObjectId(value);
}

/**
 * Load a conversation and prove the caller belongs to it. Every endpoint that
 * touches a conversation goes through here, so membership can never be
 * forgotten in one place and enforced in another.
 */
export async function requireMembership(conversationId, userId) {
  const conversation = await Conversation.findById(toObjectId(conversationId, "conversation id"));
  if (!conversation) throw new NotFoundError("Conversation not found");

  if (!conversation.hasMember(userId)) {
    // Deliberately the same answer as a missing conversation: being told
    // "forbidden" would confirm that this id exists.
    throw new NotFoundError("Conversation not found");
  }

  return conversation;
}

/** The direct chat between two people, created on first use. */
export async function findOrCreateDirect(userId, otherId) {
  if (String(userId) === String(otherId)) {
    throw new ValidationError("You cannot start a chat with yourself");
  }

  const other = await User.findById(otherId).select("_id");
  if (!other) throw new NotFoundError("That user no longer exists");

  const directKey = Conversation.buildDirectKey(userId, otherId);

  const existing = await Conversation.findOne({ directKey });
  if (existing) {
    // Reopening a chat I deleted brings it back to my list (history stays cleared).
    const me = existing.members.find((m) => String(m.user) === String(userId));
    if (me?.hidden) {
      me.hidden = false;
      await existing.save();
    }
    return existing;
  }

  try {
    return await Conversation.create({
      type: "direct",
      directKey,
      createdBy: userId,
      members: [{ user: userId }, { user: otherId }],
    });
  } catch (error) {
    // Lost a race against the other person opening the same chat.
    if (error.code === 11000) return Conversation.findOne({ directKey });
    throw error;
  }
}

export async function createGroup({ creatorId, name, memberIds }) {
  const unique = [...new Set(memberIds.map(String))].filter((id) => id !== String(creatorId));

  if (unique.length < 1) throw new ValidationError("Add at least one other person");
  if (unique.length > 99) throw new ValidationError("A group can hold at most 100 people");

  const ids = unique.map((id) => toObjectId(id, "member id"));
  const found = await User.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new ValidationError("One of those people no longer exists");

  return Conversation.create({
    type: "group",
    name,
    createdBy: creatorId,
    members: [
      { user: creatorId, role: "admin" },
      ...ids.map((user) => ({ user })),
    ],
  });
}

/** Record a message and keep the conversation's denormalised preview in step. */
export async function appendMessage(conversation, { senderId, text, image, system = false }) {
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: system ? undefined : senderId,
    text,
    image,
    system,
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessage = {
    text: text ?? "",
    senderId: system ? null : senderId,
    hasImage: Boolean(image),
    system,
    deleted: false,
  };

  // Anyone who deleted this chat gets it back, starting from this message.
  for (const member of conversation.members) member.hidden = false;

  // The sender has obviously read their own message.
  if (!system) {
    const me = conversation.members.find((m) => String(m.user) === String(senderId));
    if (me) me.lastReadAt = message.createdAt;
  }

  await conversation.save();

  return message;
}

/**
 * The sidebar: every conversation the user is in, newest first, each with a
 * preview and an unread count. Two queries total, regardless of how many
 * conversations or members there are.
 */
export async function listForUser(userId) {
  const conversations = await Conversation.find({
    members: { $elemMatch: { user: new mongoose.Types.ObjectId(String(userId)), hidden: { $ne: true } } },
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("members.user", "fullName profilePic")
    .lean();

  if (conversations.length === 0) return [];

  // Count only what is unread: messages from others after my lastReadAt, per
  // conversation. Uses the { conversationId, createdAt } index and returns one
  // small row per conversation instead of pulling every message into memory.
  const lastRead = (c) => c.members.find((m) => String(m.user._id) === String(userId))?.lastReadAt ?? new Date(0);
  const unreadRows = await Message.aggregate([
    {
      $match: {
        $or: conversations.map((c) => ({ conversationId: c._id, createdAt: { $gt: lastRead(c) } })),
        deletedAt: null,
        senderId: { $ne: new mongoose.Types.ObjectId(String(userId)) },
        system: { $ne: true },
      },
    },
    { $group: { _id: "$conversationId", n: { $sum: 1 } } },
  ]);

  const byConversation = new Map(unreadRows.map((row) => [String(row._id), row.n]));

  return conversations.map((conversation) => {
    const me = conversation.members.find((m) => String(m.user._id) === String(userId));
    const unreadCount = byConversation.get(String(conversation._id)) ?? 0;

    const others = conversation.members.filter((m) => String(m.user._id) !== String(userId));

    return {
      _id: conversation._id,
      type: conversation.type,
      // A direct chat is named after the other person.
      name: conversation.type === "group" ? conversation.name : others[0]?.user.fullName ?? "Unknown",
      image: conversation.type === "group" ? conversation.image : others[0]?.user.profilePic ?? "",
      members: conversation.members.map((m) => ({
        _id: m.user._id,
        fullName: m.user.fullName,
        profilePic: m.user.profilePic,
        role: m.role,
      })),
      otherUserId: conversation.type === "direct" ? others[0]?.user._id ?? null : null,
      isAdmin: me?.role === "admin",
      lastMessageAt: conversation.lastMessageAt,
      // A preview from before I cleared the chat is not mine to see any more.
      lastMessage:
        me?.clearedAt && conversation.lastMessageAt && conversation.lastMessageAt <= me.clearedAt
          ? null
          : conversation.lastMessage ?? null,
      unreadCount,
    };
  });
}

/**
 * How many other members have read up to a given moment. Drives "Seen" in a
 * direct chat and "Seen by 3" in a group.
 */
export function readCountAt(conversation, userId, at) {
  return conversation.members.filter(
    (m) => String(m.user._id ?? m.user) !== String(userId) && m.lastReadAt && m.lastReadAt >= at
  ).length;
}
