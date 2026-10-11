import User from "../models/user.model.js";
import { verifyToken } from "../lib/token.js";

/**
 * An expired or tampered token is a 401, not a 500. The old version let
 * jwt.verify throw into the generic catch, so after seven days every user got
 * "Internal server error" and the app had no way to recover.
 */
export async function protectRoute(req, res, next) {
  const token = req.cookies?.jwt;

  if (!token) {
    return res.status(401).json({ message: "Not signed in" });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }

  try {
    const user = await User.findById(payload.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
