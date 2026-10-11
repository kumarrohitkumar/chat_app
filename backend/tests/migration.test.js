import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { runMigration } from "../src/scripts/migrate-to-conversations.js";
import Conversation from "../src/models/conversation.model.js";
import { as, register } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();

/**
 * Write messages in the pre-group shape, straight through the driver — these
 * documents no longer fit the Mongoose model, which is the whole point.
 */
async function writeLegacy(rows) {
  await mongoose.connection.collection("messages").insertMany(rows);
}

function legacy(senderId, receiverId, text, minutesAgo) {
  const at = new Date(Date.now() - minutesAgo * 60_000);
  return { senderId, receiverId, text, readAt: null, createdAt: at, updatedAt: at };
}

describe("migrating a pre-group database", () => {
  it("does nothing when there is nothing to migrate", async () => {
    const result = await runMigration();

    expect(result.found).toBe(0);
    expect(result.migrated).toBe(0);
  });

  it("groups legacy messages into one conversation per pair", async () => {
    const alice = oid();
    const bob = oid();
    const carol = oid();

    await writeLegacy([
      legacy(alice, bob, "one", 30),
      legacy(bob, alice, "two", 20),
      legacy(alice, bob, "three", 10),
      legacy(alice, carol, "other pair", 5),
    ]);

    const result = await runMigration();

    expect(result.found).toBe(4);
    expect(result.conversations).toBe(2);
    expect(result.migrated).toBe(4);
    expect(await Conversation.countDocuments({})).toBe(2);
  });

  it("writes the newest message into the conversation preview", async () => {
    const alice = oid();
    const bob = oid();

    await writeLegacy([
      legacy(alice, bob, "older", 30),
      legacy(bob, alice, "newest", 1),
    ]);

    await runMigration();

    const conversation = await Conversation.findOne({
      directKey: Conversation.buildDirectKey(alice, bob),
    });

    expect(conversation.lastMessage.text).toBe("newest");
    expect(String(conversation.lastMessage.senderId)).toBe(String(bob));
  });

  it("clears the old fields and stamps every message with its conversation", async () => {
    const alice = oid();
    const bob = oid();

    await writeLegacy([legacy(alice, bob, "one", 10), legacy(bob, alice, "two", 5)]);

    await runMigration();

    const messages = mongoose.connection.collection("messages");

    expect(await messages.countDocuments({ conversationId: { $exists: true } })).toBe(2);
    expect(await messages.countDocuments({ receiverId: { $exists: true } })).toBe(0);
    expect(await messages.countDocuments({ readAt: { $exists: true } })).toBe(0);
  });

  it("starts everyone at 'all read', so old chats do not look unread", async () => {
    const alice = oid();
    const bob = oid();

    await writeLegacy([legacy(alice, bob, "one", 10)]);
    await runMigration();

    const conversation = await Conversation.findOne({});

    for (const member of conversation.members) {
      expect(member.lastReadAt).not.toBeNull();
      expect(member.lastReadAt >= conversation.lastMessageAt).toBe(true);
    }
  });

  it("changes nothing on a dry run", async () => {
    const alice = oid();
    const bob = oid();

    await writeLegacy([legacy(alice, bob, "one", 10)]);

    const result = await runMigration({ dryRun: true });

    expect(result.found).toBe(1);
    expect(result.conversations).toBe(1);
    expect(result.migrated).toBe(0);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it("is safe to run twice", async () => {
    const alice = oid();
    const bob = oid();

    await writeLegacy([legacy(alice, bob, "one", 10), legacy(bob, alice, "two", 5)]);

    await runMigration();
    const second = await runMigration();

    expect(second.found).toBe(0);
    expect(await Conversation.countDocuments({})).toBe(1);
  });

  it("leaves data the live app can read and add to", async () => {
    // Two real accounts, so the API will accept their cookies afterwards.
    const alice = await register({ fullName: "Legacy Alice" });
    const bob = await register({ fullName: "Legacy Bob" });

    const aliceId = new mongoose.Types.ObjectId(alice.user._id);
    const bobId = new mongoose.Types.ObjectId(bob.user._id);

    await writeLegacy([
      legacy(aliceId, bobId, "from before the upgrade", 20),
      legacy(bobId, aliceId, "and the reply", 10),
    ]);

    await runMigration();

    const list = await as(alice.cookie).get("/api/conversations");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Legacy Bob");
    expect(list.body[0].unreadCount).toBe(0);

    const conversationId = list.body[0]._id;

    const history = await as(alice.cookie).get(`/api/conversations/${conversationId}/messages`);
    expect(history.body.messages.map((m) => m.text)).toEqual([
      "from before the upgrade",
      "and the reply",
    ]);

    // And the old conversation keeps working.
    const sent = await as(bob.cookie)
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ text: "after the upgrade" });

    expect(sent.status).toBe(201);
  });
});
