import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never comes back from a query unless asked for explicitly
    },
    profilePic: {
      type: String,
      default: "",
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/** Shape sent to the browser. Keeps the password out by construction. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    fullName: this.fullName,
    email: this.email,
    profilePic: this.profilePic,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("User", userSchema);
