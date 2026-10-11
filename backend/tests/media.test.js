import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, as, register } from "./helpers.js";

// A real 2x2 PNG, so the server can decode and re-encode it.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==";

async function directChat() {
  const a = await register({ fullName: "Asha" });
  const b = await register({ fullName: "Bilal" });
  const res = await as(a.cookie).post("/api/conversations/direct").send({ userId: b.user._id });
  return { a, b, conversation: res.body };
}

describe("images", () => {
  it("stores an avatar and serves it only to signed-in users", async () => {
    const a = await register();
    const res = await as(a.cookie).put("/api/auth/update-profile").send({ profilePic: PNG });
    expect(res.status).toBe(200);
    expect(res.body.profilePic).toMatch(new RegExp(`^/api/media/avatars/${a.user._id}/[\\w-]+\\.webp$`));

    const file = await as(a.cookie).get(res.body.profilePic);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/webp");
    expect(file.headers["cache-control"]).toMatch(/private/);

    const other = await register();
    expect((await as(other.cookie).get(res.body.profilePic)).status).toBe(200);
    expect((await request(app).get(res.body.profilePic)).status).toBe(401);
  });

  it("serves a message image to members of that chat only", async () => {
    const { a, b, conversation } = await directChat();
    const sent = await as(a.cookie).post(`/api/conversations/${conversation._id}/messages`).send({ image: PNG });
    expect(sent.status).toBe(201);
    expect(sent.body.image).toMatch(new RegExp(`^/api/media/messages/${conversation._id}/[\\w-]+\\.webp$`));

    expect((await as(b.cookie).get(sent.body.image)).status).toBe(200);
    const outsider = await register();
    expect((await as(outsider.cookie).get(sent.body.image)).status).toBe(404);
  });

  it("rejects data that only claims to be an image", async () => {
    const a = await register();
    const fake = "data:image/png;base64," + Buffer.from("not really a png").toString("base64");
    const res = await as(a.cookie).put("/api/auth/update-profile").send({ profilePic: fake });
    expect(res.status).toBe(400);
  });

  it("does not serve unknown or malformed media paths", async () => {
    const a = await register();
    expect((await as(a.cookie).get("/api/media/avatars/x/../../etc.webp")).status).toBe(404);
    expect((await as(a.cookie).get(`/api/media/avatars/${a.user._id}/missing.webp`)).status).toBe(404);
    expect((await as(a.cookie).get("/api/media/secrets/abc/def.webp")).status).toBe(404);
  });

  it("reports image upload as enabled on the health check", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.imageUpload).toBe("enabled");
  });
});
