/** Small hand-rolled validators — the app has four inputs, not forty. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

export function requireEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError("Enter a valid email address");
  return email;
}

export function requireName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new ValidationError("Name must be at least 2 characters");
  if (name.length > 60) throw new ValidationError("Name must be under 60 characters");
  return name;
}

export function requirePassword(value) {
  const password = String(value ?? "");
  if (password.length < 8) throw new ValidationError("Password must be at least 8 characters");
  if (password.length > 128) throw new ValidationError("Password must be under 128 characters");
  return password;
}

export function requireImageDataUrl(value) {
  const image = String(value ?? "");
  if (!/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(image)) {
    throw new ValidationError("That file is not a supported image");
  }
  // base64 is ~4/3 of the byte size; keep uploads under roughly 5 MB.
  if (image.length > 7_000_000) {
    throw new ValidationError("That image is too large. Please use one under 5 MB.");
  }
  return image;
}

export function optionalText(value) {
  const text = String(value ?? "").trim();
  if (text.length > 4000) throw new ValidationError("Message is too long (4000 characters max)");
  return text;
}
