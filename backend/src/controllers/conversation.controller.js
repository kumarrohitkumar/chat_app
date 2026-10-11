import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { uploadImage } from "../lib/cloudinary.js";
import { emitToConversation, syncSocketRooms } from "../lib/socket.js";
import { optionalText, requireImageDataUrl, ValidationError } from "../lib/validate.js";
import {
  ForbiddenError,
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

/** Everyone except me — the people a new chat can be started with. */
export async function getContacts(req, res, next) {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("fullName email profilePic")
      .sort({ fullName: 1 })
      .lean();

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
      conversation.image = await uploadImage(requireImageDataUrl(req.body.image), "chatify/groups");
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
      // Nobody left to talk to — remove the group and its history.
      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();
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

    res.status(200).json({ removed: true, conversationDeleted: false });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const conversation = await requireMembership(req.params.id, req.user._id);

    const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    if (before && Number.isNaN(before.getTime())) {
      throw new ValidationError("Invalid `before` timestamp");
    }

    const page = await Message.find({
      conversationId: conversation._id,
      ...(before ? { createdAt: { $lt: before } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    const messages = (hasMore ? page.slice(0, limit) : page).reverse();

    res.status(200).json({
      messages: messages.map((message) => ({
        ...message,
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
      ? await uploadImage(requireImageDataUrl(req.body.image), "chatify/messages")
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
    me.lastReadAt = new Date();
    await conversation.save();

    emitToConversation(conversation, "conversationRead", {
      conversationId: conversation._id,
      by: String(req.user._id),
      at: me.lastReadAt.toISOString(),
    });

    res.status(200).json({ lastReadAt: me.lastReadAt });
  } catch (error) {
    next(error);
  }
}
