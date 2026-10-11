import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, as, register } from "./helpers.js";

describe("signup", () => {
  it("creates an account and returns a cookie, never the password", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe("Ada Lovelace");
    expect(res.body).not.toHaveProperty("password");
    expect(res.headers["set-cookie"].join()).toMatch(/jwt=.*HttpOnly/i);
  });

  it("lowercases and trims the email", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      fullName: "Case Test",
      email: "  MiXeD@Example.COM ",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("mixed@example.com");
  });

  it.each([
    ["a short password", { password: "12345" }],
    ["a malformed email", { email: "not-an-email" }],
    ["a one-character name", { fullName: "A" }],
    ["a missing email", { email: "" }],
  ])("rejects %s", async (_label, override) => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Valid Name",
        email: "valid@example.com",
        password: "secret123",
        ...override,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("rejects a duplicate email with 409", async () => {
    const { email } = await register();

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ fullName: "Impostor", email, password: "secret123" });

    expect(res.status).toBe(409);
  });
});

describe("login", () => {
  it("accepts the right password", async () => {
    const { email, password } = await register();

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    const { email } = await register();

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });
    const unknownUser = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    // Identical, so the response cannot be used to discover which emails exist.
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });
});

describe("protected routes", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(app).get("/api/auth/check");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token signed with a different secret", async () => {
    const { user } = await register();
    const forged = jwt.sign({ userId: user._id }, "a-different-secret");

    const res = await request(app).get("/api/auth/check").set("Cookie", [`jwt=${forged}`]);

    expect(res.status).toBe(401);
  });

  it("returns 401, not 500, for an expired token", async () => {
    const { user } = await register();
    const expired = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "-1h" });

    const res = await request(app).get("/api/auth/check").set("Cookie", [`jwt=${expired}`]);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/sign in/i);
  });

  it("returns the signed-in user", async () => {
    const { cookie, user } = await register();

    const res = await as(cookie).get("/api/auth/check");

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(user._id);
  });
});

describe("profile", () => {
  it("updates the display name", async () => {
    const { cookie } = await register();

    const res = await as(cookie).put("/api/auth/update-profile").send({ fullName: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("New Name");
  });

  it("rejects a profilePic that is not an image data URL", async () => {
    const { cookie } = await register();

    const res = await as(cookie)
      .put("/api/auth/update-profile")
      .send({ profilePic: "https://evil.example.com/not-a-data-url" });

    expect(res.status).toBe(400);
  });
});
