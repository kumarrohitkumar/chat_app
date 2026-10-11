import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { removeImage, uploadImage } from "../lib/storage.js";
import { emitToConversation, emitToUser, syncSocketRooms } from "../lib/socket.js";
import { optionalText, requireImageDataUrl, ValidationError } from "../lib/validate.js";
import {
  ForbiddenError,
  NotFoundError,
  appendMessage,
  createGroup,
  findOrCreateDirect,
  listForUser,
  readCountAt,
  requireMembership,
  toObjectId,
} from "../services/conversation.service.js";

const PAGE_SIZE = 40;

function requireGroupName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new ValidationError("Group name must be at least 2 characters");
  if (name.length > 60) throw new ValidationError("Group name must be under 60 characters");
  return name;
}

/**
 * Everyone except me — the people a new chat can be started with. Names and
 * photos only: listing every user's email to every user leaks them. Someone
 * who knows an exact email can still find that person with ?email=.
 */
export async function getContacts(req, res, next) {
  try {
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    const filter = { _id: { $ne: req.user._id } };
    if (email) filter.email = email;

    const users = await User.find(filter).select("fullName profilePic").sort({ fullName: 1 }).lean();

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

export async function listConversations(req, res, next) {
  try {
    res.status(200).json(await listForUser(req.user._id));
  } catch (error) {
    next(error);
  }
}

export async function openDirect(req, res, next) {
  try {
    const otherId = toObjectId(req.body.userId, "user id");
    const conversation = await findOrCreateDirect(req.user._id, otherId);

    // Both people need to be in the room before the first message is sent.
    syncSocketRooms(conversation);

    const [summary] = (await listForUser(req.user._id)).filter(
      (c) => String(c._id) === String(conversation._id)
    );

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

export async function startGroup(req, res, next) {
  try {
    const name = requireGroupName(req.body.name);
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

    const conversation = await createGroup({ creatorId: req.user._id, name, memberIds });

    await appendMessage(conversation, {
      system: true,
      text: `${req.user.fullName} created “${name}”`,
    });

    syncSocketRooms(conversation);

    // Everyone in the group gets the new row in their sidebar immediately.
    emitToConversation(conversation, "conversationCreated", { conversationId: conversation._id });

    const [summary] = (await listForUser(req.user._id)).filter(
      (c) => String(c._id) === String(conversation._id)
    );

    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
}

export async function renameGroup(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    if (conversation.type !== "group") throw new ValidationError("Only groups can be renamed");
    if (!conversation.isAdmin(req.user._id)) {
      throw new ForbiddenError("Only an admin can rename this group");
    }

    const name = requireGroupName(req.body.name);
    const previous = conversation.name;
    conversation.name = name;

    if (req.body.image) {
      conversation.image = await uploadImage(requireImageDataUrl(req.body.image), "groups", conversation._id);
    }

    await conversation.save();

    const note = await appendMessage(conversation, {
      system: true,
      text: `${req.user.fullName} renamed the group from “${previous}” to “${name}”`,
    });

    emitToConversation(conversation, "newMessage", note);
    emitToConversation(conversation, "conversationUpdated", { conversationId: conversation._id });

    res.status(200).json({ _id: conversation._id, name: conversation.name });
  } catch (error) {
    next(error);
  }
}

export async function addMembers(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    if (conversation.type !== "group") throw new ValidationError("Only groups take new members");
    if (!conversation.isAdmin(req.user._id)) {
      throw new ForbiddenError("Only an admin can add people");
    }

    const requested = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const ids = [...new Set(requested.map(String))]
      .filter((id) => !conversation.hasMember(id))
      .map((id) => toObjectId(id, "member id"));

    if (ids.length === 0) throw new ValidationError("Those people are already in the group");
    if (conversation.members.length + ids.length > 100) {
      throw new ValidationError("A group can hold at most 100 people");
    }

    const users = await User.find({ _id: { $in: ids } }).select("fullName").lean();
    if (users.length !== ids.length) throw new ValidationError("One of those people no longer exists");

    conversation.members.push(...ids.map((user) => ({ user })));
    await conversation.save();

    const note = await appendMessage(conversation, {
      system: true,
      text: `${req.user.fullName} added ${users.map((u) => u.fullName).join(", ")}`,
    });

    syncSocketRooms(conversation);
    emitToConversation(conversation, "newMessage", note);
    emitToConversation(conversation, "conversationUpdated", { conversationId: conversation._id });

    res.status(200).json({ added: users.length });
  } catch (error) {
    next(error);
  }
}

/** Removing yourself is leaving; removing anyone else needs admin. */
export async function removeMember(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);
    const targetId = String(req.params.userId);
    const isSelf = targetId === String(req.user._id);

    if (conversation.type !== "group") throw new ValidationError("Only groups have members");
    if (!conversation.hasMember(targetId)) throw new ValidationError("They are not in this group");
    if (!isSelf && !conversation.isAdmin(req.user._id)) {
      throw new ForbiddenError("Only an admin can remove someone");
    }

    const target = await User.findById(targetId).select("fullName").lean();
    const wasOnlyAdmin =
      conversation.isAdmin(targetId) &&
      conversation.members.filter((m) => m.role === "admin").length === 1;

    conversation.members = conversation.members.filter((m) => String(m.user) !== targetId);

    if (conversation.members.length < 2) {
      // Nobody left to talk to — remove the group and its history, and tell
      // whoever is left (and the person leaving, in their other tabs).
      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();
      for (const memberId of [...conversation.memberIds(), targetId]) {
        emitToUser(memberId, "conversationRemoved", { conversationId: conversation._id, reason: "deleted" });
      }
      return res.status(200).json({ removed: true, conversationDeleted: true });
    }

    // Never leave a group with no admin: promote the longest-standing member.
    if (wasOnlyAdmin) conversation.members[0].role = "admin";

    await conversation.save();

    const note = await appendMessage(conversation, {
      system: true,
      text: isSelf
        ? `${req.user.fullName} left the group`
        : `${req.user.fullName} removed ${target?.fullName ?? "someone"}`,
    });

    syncSocketRooms(conversation);
    emitToConversation(conversation, "newMessage", note);
    emitToConversation(conversation, "conversationUpdated", { conversationId: conversation._id });
    // They have left the room by now, so tell them directly.
    emitToUser(targetId, "conversationRemoved", { conversationId: conversation._id, reason: isSelf ? "left" : "removed" });

    res.status(200).json({ removed: true, conversationDeleted: false });
  } catch (error) {
    next(error);
  }
}

/** A deleted message keeps its place in the transcript but loses its content. */
function presentMessage(message) {
  if (!message.deletedAt) return { ...message, deleted: false };
  return { ...message, text: "", image: null, deleted: true };
}

export async function getMessages(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    if (before && Number.isNaN(before.getTime())) {
      throw new ValidationError("Invalid `before` timestamp");
    }

    // Hide whatever came before I cleared this chat.
    const me = conversation.members.find((m) => String(m.user) === String(req.user._id));
    const createdAt = {
      ...(before ? { $lt: before } : {}),
      ...(me?.clearedAt ? { $gt: me.clearedAt } : {}),
    };

    const page = await Message.find({
      conversationId: conversation._id,
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    const messages = (hasMore ? page.slice(0, limit) : page).reverse();

    res.status(200).json({
      messages: messages.map((message) => ({
        ...presentMessage(message),
        // How many other members have read it — "Seen" or "Seen by 3".
        readBy: readCountAt(conversation, req.user._id, message.createdAt),
      })),
      hasMore,
      memberCount: conversation.members.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    const text = optionalText(req.body.text);
    const hasImage = Boolean(req.body.image);
    if (!text && !hasImage) throw new ValidationError("A message needs text or an image");

    const image = hasImage
      ? await uploadImage(requireImageDataUrl(req.body.image), "messages", conversation._id)
      : undefined;

    const message = await appendMessage(conversation, { senderId: req.user._id, text, image });

    // One emit to the room reaches every member's every tab, including the
    // sender's — so all devices show exactly what was stored.
    emitToConversation(conversation, "newMessage", message);

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    const me = conversation.members.find((m) => String(m.user) === String(req.user._id));
    const previousAt = me.lastReadAt ?? null;
    me.lastReadAt = new Date();
    await conversation.save();

    // previousAt lets clients count this reader once, only for messages that
    // fall between their last read and now.
    emitToConversation(conversation, "conversationRead", {
      conversationId: conversation._id,
      by: String(req.user._id),
      at: me.lastReadAt.toISOString(),
      previousAt: previousAt ? previousAt.toISOString() : null,
    });

    res.status(200).json({ lastReadAt: me.lastReadAt });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/conversations/:id/messages/:messageId
 * The sender deletes their own message for everyone. The bubble stays as
 * "This message was deleted" so replies around it still make sense.
 */
export async function deleteMessage(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);
    const message = await Message.findOne({
      _id: toObjectId(req.params.messageId, "message id"),
      conversationId: conversation._id,
    });
    if (!message) throw new NotFoundError("Message not found");
    if (message.system || String(message.senderId) !== String(req.user._id)) {
      throw new ForbiddenError("You can only delete messages you sent");
    }

    if (!message.deletedAt) {
      const image = message.image;
      await Message.updateOne({ _id: message._id }, { $set: { deletedAt: new Date(), text: "" }, $unset: { image: 1 } });
      await removeImage(image);

      // If it was the latest message, the sidebar preview must not keep showing it.
      if (conversation.lastMessageAt && message.createdAt.getTime() === conversation.lastMessageAt.getTime()) {
        conversation.lastMessage = { text: "", senderId: message.senderId, hasImage: false, system: false, deleted: true };
        await conversation.save();
      }

      emitToConversation(conversation, "messageDeleted", {
        conversationId: conversation._id,
        messageId: message._id,
      });
    }

    res.status(200).json({ deleted: true, messageId: message._id });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/conversations/:id
 * "Delete chat" for me only: clears my history and takes the chat off my
 * list until someone writes again. Nobody else is affected, and I stay a
 * member of a group.
 */
export async function deleteConversationForMe(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);
    const me = conversation.members.find((m) => String(m.user) === String(req.user._id));
    const now = new Date();
    me.clearedAt = now;
    me.lastReadAt = now;
    me.hidden = true;
    await conversation.save();

    // My other tabs drop it too.
    emitToUser(req.user._id, "conversationRemoved", { conversationId: conversation._id, reason: "cleared" });

    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
}
