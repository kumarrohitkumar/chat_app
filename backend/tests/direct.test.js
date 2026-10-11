import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, as, findConversation, openDirect, register, say } from "./helpers.js";

async function pair() {
  const alice = await register({ fullName: "Alice Adams" });
  const bob = await register({ fullName: "Bob Brown" });
  const chat = await openDirect(alice, bob.user._id);
  return { alice, bob, chat };
}

describe("opening a direct chat", () => {
  it("creates it on first use and names it after the other person", async () => {
    const { chat, bob } = await pair();

    expect(chat.type).toBe("direct");
    expect(chat.name).toBe(bob.user.fullName);
    expect(chat.members).toHaveLength(2);
  });

  it("returns the same conversation when either side opens it again", async () => {
    const { alice, bob, chat } = await pair();

    const again = await openDirect(alice, bob.user._id);
    const fromTheOtherSide = await openDirect(bob, alice.user._id);

    expect(again._id).toBe(chat._id);
    expect(fromTheOtherSide._id).toBe(chat._id);
  });

  it("refuses a chat with yourself", async () => {
    const { alice } = await pair();

    const res = await as(alice.cookie)
      .post("/api/conversations/direct")
      .send({ userId: alice.user._id });

    expect(res.status).toBe(400);
  });

  it("404s for a user that does not exist", async () => {
    const { alice } = await pair();

    const res = await as(alice.cookie)
      .post("/api/conversations/direct")
      .send({ userId: "64b7f3a2c1d4e5f6a7b8c9d0" });

    expect(res.status).toBe(404);
  });

  it("rejects a malformed id with 400, not 500", async () => {
    const { alice } = await pair();

    const res = await as(alice.cookie).post("/api/conversations/direct").send({ userId: "nope" });

    expect(res.status).toBe(400);
  });
});

describe("sending and reading", () => {
  it("stores a message and shows it to both sides in order", async () => {
    const { alice, bob, chat } = await pair();

    await say(alice, chat._id, "first");
    await say(bob, chat._id, "second");
    await say(alice, chat._id, "third");

    const res = await as(bob.cookie).get(`/api/conversations/${chat._id}/messages`);

    expect(res.status).toBe(200);
    expect(res.body.messages.map((m) => m.text)).toEqual(["first", "second", "third"]);
    expect(res.body.hasMore).toBe(false);
  });

  it.each([
    ["an empty message", { text: "   " }],
    ["no fields at all", {}],
    ["an oversized message", { text: "x".repeat(4001) }],
  ])("rejects %s", async (_label, body) => {
    const { alice, chat } = await pair();

    const res = await as(alice.cookie).post(`/api/conversations/${chat._id}/messages`).send(body);

    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const { chat } = await pair();

    const res = await request(app).post(`/api/conversations/${chat._id}/messages`).send({ text: "hi" });

    expect(res.status).toBe(401);
  });

  it("pages backwards with `before`", async () => {
    const { alice, chat } = await pair();

    for (let i = 1; i <= 5; i += 1) await say(alice, chat._id, `message ${i}`);

    const newest = await as(alice.cookie).get(`/api/conversations/${chat._id}/messages?limit=2`);
    expect(newest.body.hasMore).toBe(true);
    expect(newest.body.messages.map((m) => m.text)).toEqual(["message 4", "message 5"]);

    const older = await as(alice.cookie).get(
      `/api/conversations/${chat._id}/messages?limit=2&before=${newest.body.messages[0].createdAt}`
    );
    expect(older.body.messages.map((m) => m.text)).toEqual(["message 2", "message 3"]);
  });

  it("rejects an unparseable `before`", async () => {
    const { alice, chat } = await pair();

    const res = await as(alice.cookie).get(
      `/api/conversations/${chat._id}/messages?before=yesterday`
    );

    expect(res.status).toBe(400);
  });
});

describe("access control", () => {
  it("hides a conversation from someone who is not in it", async () => {
    const { alice, chat } = await pair();
    const carol = await register({ fullName: "Carol Clarke" });

    await say(alice, chat._id, "private between us");

    const read = await as(carol.cookie).get(`/api/conversations/${chat._id}/messages`);
    const write = await as(carol.cookie)
      .post(`/api/conversations/${chat._id}/messages`)
      .send({ text: "butting in" });

    // 404 rather than 403, so the response does not confirm the id exists.
    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
  });

  it("keeps it out of a non-member's conversation list", async () => {
    const { chat } = await pair();
    const carol = await register({ fullName: "Carol Clarke" });

    expect(await findConversation(carol, chat._id)).toBeUndefined();
  });
});

describe("unread counts and read state", () => {
  it("counts what the other person sent while I was away", async () => {
    const { alice, bob, chat } = await pair();

    await say(bob, chat._id, "one");
    await say(bob, chat._id, "two");

    expect((await findConversation(alice, chat._id)).unreadCount).toBe(2);
  });

  it("does not count my own messages as unread", async () => {
    const { alice, chat } = await pair();

    await say(alice, chat._id, "mine");

    expect((await findConversation(alice, chat._id)).unreadCount).toBe(0);
  });

  it("clears once the conversation is marked read", async () => {
    const { alice, bob, chat } = await pair();

    await say(bob, chat._id, "unread");
    await as(alice.cookie).post(`/api/conversations/${chat._id}/read`);

    expect((await findConversation(alice, chat._id)).unreadCount).toBe(0);
  });

  it("reports how many others have read a message", async () => {
    const { alice, bob, chat } = await pair();

    await say(alice, chat._id, "did you see this?");

    const before = await as(alice.cookie).get(`/api/conversations/${chat._id}/messages`);
    expect(before.body.messages.at(-1).readBy).toBe(0);

    await as(bob.cookie).post(`/api/conversations/${chat._id}/read`);

    const after = await as(alice.cookie).get(`/api/conversations/${chat._id}/messages`);
    expect(after.body.messages.at(-1).readBy).toBe(1);
  });
});

describe("the conversation list", () => {
  it("puts the most recent conversation first", async () => {
    const alice = await register({ fullName: "Alice Adams" });
    const bob = await register({ fullName: "Bob Brown" });
    const carol = await register({ fullName: "Carol Clarke" });

    const withBob = await openDirect(alice, bob.user._id);
    const withCarol = await openDirect(alice, carol.user._id);

    await say(alice, withBob._id, "older");
    await say(alice, withCarol._id, "newer");

    const list = await as(alice.cookie).get("/api/conversations");

    expect(list.body[0]._id).toBe(withCarol._id);
    expect(list.body[1]._id).toBe(withBob._id);
  });

  it("carries a preview of the last message", async () => {
    const { alice, bob, chat } = await pair();

    await say(bob, chat._id, "the latest thing");

    const row = await findConversation(alice, chat._id);

    expect(row.lastMessage.text).toBe("the latest thing");
    expect(String(row.lastMessage.senderId)).toBe(bob.user._id);
    expect(row.lastMessage.hasImage).toBe(false);
  });

  it("lists contacts without including me", async () => {
    const { alice, bob } = await pair();

    const res = await as(alice.cookie).get("/api/conversations/contacts");

    expect(res.body.map((u) => u._id)).toContain(bob.user._id);
    expect(res.body.map((u) => u._id)).not.toContain(alice.user._id);
  });
});
