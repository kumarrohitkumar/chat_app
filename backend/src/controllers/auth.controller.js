import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { setAuthCookie, clearAuthCookie } from "../lib/token.js";
import { uploadImage } from "../lib/storage.js";
import {
  requireEmail,
  requireName,
  requirePassword,
  requireImageDataUrl,
} from "../lib/validate.js";

export async function signup(req, res, next) {
  try {
    const fullName = requireName(req.body.fullName);
    const email = requireEmail(req.body.email);
    const password = requirePassword(req.body.password);

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, email, password: hashedPassword });

    setAuthCookie(res, user._id);
    res.status(201).json(user.toPublicJSON());
  } catch (error) {
    // Two signups racing on the same email land here via the unique index.
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with that email already exists" });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = requireEmail(req.body.email);
    const password = String(req.body.password ?? "");

    // `password` is select:false on the model, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");

    // Same message and roughly the same work either way, so the response does
    // not reveal whether the email exists.
    const passwordMatches = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Email or password is incorrect" });
    }

    setAuthCookie(res, user._id);
    res.status(200).json(user.toPublicJSON());
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.status(200).json({ message: "Signed out" });
}

export async function updateProfile(req, res, next) {
  try {
    const update = {};

    if (req.body.profilePic !== undefined) {
      const dataUrl = requireImageDataUrl(req.body.profilePic);
      update.profilePic = await uploadImage(dataUrl, "avatars", req.user._id);
    }

    if (req.body.fullName !== undefined) {
      update.fullName = requireName(req.body.fullName);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    });

    res.status(200).json(user.toPublicJSON());
  } catch (error) {
    next(error);
  }
}

export function checkAuth(req, res) {
  res.status(200).json(req.user.toPublicJSON());
}
