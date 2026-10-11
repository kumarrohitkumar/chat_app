import mongoose from "mongoose";

/**
 * One model for both kinds of chat. A direct chat is simply a conversation
 * with two members and `type: "direct"`, so every feature built on top —
 * unread counts, previews, typing, read state — works for groups with no
 * second code path.
 */
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    // Read state lives here rather than on every message: a conversation has
    // a handful of members, but may have thousands of messages.
    lastReadAt: { type: Date, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },

    // Groups only.
    name: { type: String, trim: true, maxlength: 60 },
    image: { type: String, default: "" },

    members: {
      type: [memberSchema],
      validate: [(value) => value.length >= 2, "A conversation needs at least two members"],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /**
     * The two member ids, sorted and joined. A unique index on it means two
     * people cannot end up with two separate direct chats, even if both press
     * "message" at the same moment.
     */
    directKey: { type: String, default: undefined },

    lastMessageAt: { type: Date, default: null },
    // Denormalised so the conversation list is one query, not one per row.
    lastMessage: {
      text: { type: String, default: "" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      hasImage: { type: Boolean, default: false },
      system: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ "members.user": 1, lastMessageAt: -1 });
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });

/** Deterministic key for a pair, whichever order they arrive in. */
conversationSchema.statics.buildDirectKey = function buildDirectKey(a, b) {
  return [String(a), String(b)].sort().join(":");
};

conversationSchema.methods.memberIds = function memberIds() {
  return this.members.map((m) => String(m.user));
};

conversationSchema.methods.hasMember = function hasMember(userId) {
  return this.members.some((m) => String(m.user) === String(userId));
};

conversationSchema.methods.isAdmin = function isAdmin(userId) {
  return this.members.some((m) => String(m.user) === String(userId) && m.role === "admin");
};

export default mongoose.model("Conversation", conversationSchema);
