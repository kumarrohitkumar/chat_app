import { describe, expect, it } from "vitest";
import { as, createGroup, findConversation, register, say } from "./helpers.js";

describe("privacy and limits", () => {
  it("lists contacts by name and photo without exposing emails", async () => {
    const me = await register({ fullName: "Asha" });
    await register({ fullName: "Bilal", email: "bilal@example.com" });
    const res = await as(me.cookie).get("/api/conversations/contacts");
    expect(res.status).toBe(200);
    expect(res.body.find((u) => u.fullName === "Bilal")).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });

  it("finds a person by their exact email, and only them", async () => {
    const me = await register();
    const bilal = await register({ fullName: "Bilal", email: "bilal@example.com" });
    const hit = await as(me.cookie).get("/api/conversations/contacts?email=BILAL@example.com");
    expect(hit.body).toEqual([expect.objectContaining({ _id: bilal.user._id, fullName: "Bilal" })]);
    expect((await as(me.cookie).get("/api/conversations/contacts?email=bil")).body).toEqual([]);
  });

  it("does not expose member emails in the conversation list", async () => {
    const a = await register();
    const b = await register({ email: "secret-b@example.com" });
    const group = await createGroup(a, "Team", [b.user._id]);
    const conv = await findConversation(a, group._id);
    expect(JSON.stringify(conv.members)).not.toMatch(/secret-b/);
  });

  it("counts unread messages per conversation correctly", async () => {
    const a = await register();
    const b = await register();
    const group = await createGroup(a, "Team", [b.user._id]);
    await say(a, group._id, "one");
    await say(a, group._id, "two");
    await say(b, group._id, "mine");
    expect((await findConversation(b, group._id)).unreadCount).toBe(0); // replying marks read
    await say(a, group._id, "three");
    expect((await findConversation(b, group._id)).unreadCount).toBe(1);
    expect((await findConversation(a, group._id)).unreadCount).toBe(0);
  });

  it("rejects a large body on sign-up, where no image is expected", async () => {
    const res = await as([]).post("/api/auth/signup").send({ fullName: "x".repeat(300_000), email: "big@example.com", password: "secret123" });
    expect(res.status).toBe(413);
  });

  it("asks for at least 8 characters in a new password", async () => {
    const res = await as([]).post("/api/auth/signup").send({ fullName: "Short Pass", email: "short@example.com", password: "abc1234" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/);
  });
});
