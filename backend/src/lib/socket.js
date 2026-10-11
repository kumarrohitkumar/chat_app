import { Server } from "socket.io";
import { env } from "./env.js";
import { readTokenFromCookieHeader, verifyToken } from "./token.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";

/**
 * Who is online: userId -> set of socket ids.
 * A set, not a single id, because one person may have several tabs open —
 * closing one tab used to mark them offline everywhere.
 */
const userSockets = new Map();

/**
 * Created when the HTTP server starts. Left null under test, where the
 * controllers run without a socket layer; the emit helpers below no-op.
 */
let io = null;

export function getIO() {
  return io;
}

export function getReceiverSocketIds(userId) {
  return [...(userSockets.get(String(userId)) ?? [])];
}

export function isUserOnline(userId) {
  return userSockets.has(String(userId));
}

function onlineUserIds() {
  return [...userSockets.keys()];
}

/** Send an event to every tab a user has open. */
export function emitToUser(userId, event, payload) {
  if (!io) return;
  for (const socketId of getReceiverSocketIds(userId)) {
    io.to(socketId).emit(event, payload);
  }
}

const room = (conversationId) => `conversation:${conversationId}`;

/**
 * One emit per conversation instead of one per member. A group of fifty is
 * the same amount of work as a direct chat.
 */
export function emitToConversation(conversation, event, payload) {
  if (!io) return;
  io.to(room(conversation._id)).emit(event, payload);
}

/**
 * Keep room membership in step with the member list, so someone added to a
 * group starts receiving its messages without reloading, and someone removed
 * stops immediately.
 */
export function syncSocketRooms(conversation) {
  if (!io) return;

  const target = room(conversation._id);
  const memberIds = new Set(conversation.memberIds());

  for (const [userId, socketIds] of userSockets) {
    for (const socketId of socketIds) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;

      if (memberIds.has(userId)) socket.join(target);
      else socket.leave(target);
    }
  }
}

/** Put a freshly connected socket into every room its user belongs to. */
async function joinExistingRooms(socket) {
  const conversations = await Conversation.find({ "members.user": socket.userId })
    .select("_id")
    .lean();

  for (const conversation of conversations) socket.join(room(conversation._id));
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
  });

  /**
   * The identity comes from the signed auth cookie, never from the client.
   * Previously the browser sent `?userId=...` and the server believed it, so
   * anyone could appear online as anyone else.
   */
  io.use(async (socket, next) => {
    try {
      const token = readTokenFromCookieHeader(socket.handshake.headers.cookie);
      if (!token) return next(new Error("unauthorized"));

      const { userId } = verifyToken(token);
      // A token outlives a deleted account; check the user still exists.
      if (!userId || !(await User.exists({ _id: userId }))) return next(new Error("unauthorized"));

      socket.userId = String(userId);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId } = socket;

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    await joinExistingRooms(socket).catch((error) =>
      console.error("[socket] could not join rooms:", error.message)
    );

    io.emit("getOnlineUsers", onlineUserIds());
    socket.emit("ready");

    // Typing goes to the conversation's room, so a group sees it too. The
    // sender is excluded — nobody needs to watch themselves type. A socket is
    // only in the rooms of conversations its user belongs to, so that is the
    // membership check.
    const typingIn = new Set();
    const isMember = (conversationId) => typeof conversationId === "string" && socket.rooms.has(room(conversationId));

    socket.on("typing", ({ conversationId } = {}) => {
      if (!isMember(conversationId)) return;
      typingIn.add(conversationId);
      socket.to(room(conversationId)).emit("userTyping", { conversationId, from: userId });
    });

    socket.on("stopTyping", ({ conversationId } = {}) => {
      if (!isMember(conversationId)) return;
      typingIn.delete(conversationId);
      socket.to(room(conversationId)).emit("userStoppedTyping", { conversationId, from: userId });
    });

    // Rooms are already gone by "disconnect", so clear indicators while leaving.
    socket.on("disconnecting", () => {
      for (const conversationId of typingIn) {
        socket.to(room(conversationId)).emit("userStoppedTyping", { conversationId, from: userId });
      }
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (!sockets) return;

      sockets.delete(socket.id);
      if (sockets.size === 0) userSockets.delete(userId);

      io.emit("getOnlineUsers", onlineUserIds());
    });
  });

  return io;
}

export async function closeSocket() {
  if (!io) return;
  await io.close();
  io = null;
  userSockets.clear();
}
