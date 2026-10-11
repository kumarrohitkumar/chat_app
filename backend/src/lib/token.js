import jwt from "jsonwebtoken";
import { env } from "./env.js";

const COOKIE_NAME = "jwt";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function signToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function setAuthCookie(res, userId) {
  const token = signToken(userId);

  res.cookie(COOKIE_NAME, token, {
    maxAge: MAX_AGE_MS,
    httpOnly: true, // not readable by JavaScript, so XSS cannot steal it
    sameSite: env.isProduction ? "strict" : "lax",
    secure: env.isProduction, // HTTPS only in production
  });

  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: env.isProduction ? "strict" : "lax",
    secure: env.isProduction,
  });
}

/** Minimal cookie-header parser — Socket.IO handshakes do not run Express middleware. */
export function readTokenFromCookieHeader(header) {
  if (!header) return null;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === COOKIE_NAME) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export { COOKIE_NAME };
