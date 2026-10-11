import { env } from "../lib/env.js";

/**
 * Errors we raised ourselves carry a statusCode and a message written for the
 * user, so they pass through. Anything else is an unexpected bug: log it in
 * full, show the user nothing that reveals the internals.
 */
export function errorHandler(error, req, res, _next) {
  const deliberate = Number.isInteger(error.statusCode);
  const status = deliberate ? error.statusCode : 500;

  if (!deliberate || status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  const message = deliberate ? error.message : "Something went wrong on our side";

  res.status(status).json({
    message,
    ...(env.isProduction || deliberate ? {} : { detail: error.message }),
  });
}

export function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}
