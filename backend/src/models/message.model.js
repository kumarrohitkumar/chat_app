import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // A system note ("Ravi added Priya") has no human sender.
      required: function requiredUnlessSystem() {
        return !this.system;
      },
    },
    text: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    image: {
      type: String,
    },
    /** Rendered as a centred grey line rather than a bubble. */
    system: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/** Every conversation read walks this index. */
messageSchema.index({ conversationId: 1, createdAt: -1 });

messageSchema.pre("validate", function requireContent(next) {
  if (!this.text && !this.image && !this.deletedAt) {
    next(new Error("A message needs text or an image"));
    return;
  }
  next();
});

export default mongoose.model("Message", messageSchema);
