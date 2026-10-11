import rateLimit from "express-rate-limit";

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a moment and try again." },
};

/** Sign-in and sign-up: the endpoints worth brute-forcing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  ...common,
});

/** Sending messages: generous for a human, cheap insurance against a script. */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  ...common,
});

/** Everything else. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  ...common,
});
