import { describe, expect, it } from "vitest";
import { as, createGroup, findConversation, register, say } from "./helpers.js";

async function team() {
  const owner = await register({ fullName: "Owner One" });
  const member = await register({ fullName: "Member Two" });
  const other = await register({ fullName: "Other Three" });
  const outsider = await register({ fullName: "Outsider Four" });

  const group = await createGroup(owner, "Release Crew", [member.user._id, other.user._id]);
  return { owner, member, other, outsider, group };
}

async function messagesIn(who, groupId) {
  const res = await as(who.cookie).get(`/api/conversations/${groupId}/messages`);
  return res.body.messages;
}

describe("creating a group", () => {
  it("names it, makes the creator an admin, and includes everyone", async () => {
    const { owner, group } = await team();

    expect(group.type).toBe("group");
    expect(group.name).toBe("Release Crew");
    expect(group.members).toHaveLength(3);
    expect(group.isAdmin).toBe(true);

    const ownerRow = group.members.find((m) => m._id === owner.user._id);
    expect(ownerRow.role).toBe("admin");
  });

  it("shows up for every member, as a member rather than an admin", async () => {
    const { member, group } = await team();

    const row = await findConversation(member, group._id);

    expect(row).toBeDefined();
    expect(row.name).toBe("Release Crew");
    expect(row.isAdmin).toBe(false);
  });

  it("opens with a system note rather than an empty screen", async () => {
    const { owner, group } = await team();

    const messages = await messagesIn(owner, group._id);

    expect(messages).toHaveLength(1);
    expect(messages[0].system).toBe(true);
    expect(messages[0].text).toContain("created");
  });

  it.each([
    ["a one-character name", { name: "x" }],
    ["a blank name", { name: "   " }],
    ["nobody else in it", { memberIds: [] }],
  ])("rejects %s", async (_label, override) => {
    const { owner, member } = await team();

    const res = await as(owner.cookie)
      .post("/api/conversations/group")
      .send({ name: "Valid Name", memberIds: [member.user._id], ...override });

    expect(res.status).toBe(400);
  });

  it("rejects a member who does not exist", async () => {
    const { owner } = await team();

    const res = await as(owner.cookie)
      .post("/api/conversations/group")
      .send({ name: "Ghosts", memberIds: ["64b7f3a2c1d4e5f6a7b8c9d0"] });

    expect(res.status).toBe(400);
  });

  it("does not duplicate the creator if they list themselves", async () => {
    const { owner, member } = await team();

    const group = await createGroup(owner, "Twice", [owner.user._id, member.user._id]);

    expect(group.members).toHaveLength(2);
  });
});

describe("talking in a group", () => {
  it("delivers a message to every member", async () => {
    const { owner, member, other, group } = await team();

    await say(member, group._id, "build is tagged");

    for (const who of [owner, member, other]) {
      const texts = (await messagesIn(who, group._id)).map((m) => m.text);
      expect(texts).toContain("build is tagged");
    }
  });

  it("counts unread per member, and not for the sender", async () => {
    const { owner, member, other, group } = await team();

    await say(member, group._id, "one");
    await say(member, group._id, "two");

    expect((await findConversation(owner, group._id)).unreadCount).toBe(2);
    expect((await findConversation(other, group._id)).unreadCount).toBe(2);
    expect((await findConversation(member, group._id)).unreadCount).toBe(0);
  });

  it("reports how many members have read a message", async () => {
    const { owner, member, other, group } = await team();

    await say(owner, group._id, "please confirm");

    expect((await messagesIn(owner, group._id)).at(-1).readBy).toBe(0);

    await as(member.cookie).post(`/api/conversations/${group._id}/read`);
    expect((await messagesIn(owner, group._id)).at(-1).readBy).toBe(1);

    await as(other.cookie).post(`/api/conversations/${group._id}/read`);
    expect((await messagesIn(owner, group._id)).at(-1).readBy).toBe(2);
  });

  it("shuts an outsider out of reading and writing", async () => {
    const { owner, outsider, group } = await team();

    await say(owner, group._id, "internal");

    const read = await as(outsider.cookie).get(`/api/conversations/${group._id}/messages`);
    const write = await as(outsider.cookie)
      .post(`/api/conversations/${group._id}/messages`)
      .send({ text: "hello?" });

    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
  });
});

describe("managing members", () => {
  it("lets an admin add someone, with a system note", async () => {
    const { owner, outsider, group } = await team();

    const res = await as(owner.cookie)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [outsider.user._id] });

    expect(res.status).toBe(200);
    expect(await findConversation(outsider, group._id)).toBeDefined();

    const note = (await messagesIn(owner, group._id)).at(-1);
    expect(note.system).toBe(true);
    expect(note.text).toContain("Outsider Four");
  });

  it("refuses to let a plain member add anyone", async () => {
    const { member, outsider, group } = await team();

    const res = await as(member.cookie)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [outsider.user._id] });

    expect(res.status).toBe(403);
  });

  it("rejects adding someone who is already in", async () => {
    const { owner, member, group } = await team();

    const res = await as(owner.cookie)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [member.user._id] });

    expect(res.status).toBe(400);
  });

  it("lets an admin remove a member", async () => {
    const { owner, member, group } = await team();

    const res = await as(owner.cookie).delete(
      `/api/conversations/${group._id}/members/${member.user._id}`
    );

    expect(res.status).toBe(200);
    expect(await findConversation(member, group._id)).toBeUndefined();
  });

  it("refuses to let a member remove someone else", async () => {
    const { member, other, group } = await team();

    const res = await as(member.cookie).delete(
      `/api/conversations/${group._id}/members/${other.user._id}`
    );

    expect(res.status).toBe(403);
  });

  it("lets anyone remove themselves", async () => {
    const { member, group } = await team();

    const res = await as(member.cookie).delete(
      `/api/conversations/${group._id}/members/${member.user._id}`
    );

    expect(res.status).toBe(200);
    expect(await findConversation(member, group._id)).toBeUndefined();
  });

  it("promotes someone when the only admin leaves, so the group keeps one", async () => {
    const { owner, member, group } = await team();

    await as(owner.cookie).delete(`/api/conversations/${group._id}/members/${owner.user._id}`);

    const row = await findConversation(member, group._id);
    expect(row.members.some((m) => m.role === "admin")).toBe(true);
  });

  it("deletes the group once it would drop below two people", async () => {
    const { owner, member, other, group } = await team();

    await as(owner.cookie).delete(`/api/conversations/${group._id}/members/${other.user._id}`);
    const last = await as(owner.cookie).delete(
      `/api/conversations/${group._id}/members/${member.user._id}`
    );

    expect(last.body.conversationDeleted).toBe(true);
    expect(await findConversation(owner, group._id)).toBeUndefined();
  });
});

describe("renaming", () => {
  it("lets an admin rename, and records it", async () => {
    const { owner, group } = await team();

    const res = await as(owner.cookie)
      .patch(`/api/conversations/${group._id}`)
      .send({ name: "Ship Team" });

    expect(res.status).toBe(200);
    expect((await findConversation(owner, group._id)).name).toBe("Ship Team");

    const note = (await messagesIn(owner, group._id)).at(-1);
    expect(note.text).toContain("Ship Team");
  });

  it("refuses a plain member", async () => {
    const { member, group } = await team();

    const res = await as(member.cookie)
      .patch(`/api/conversations/${group._id}`)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("refuses to rename a direct chat", async () => {
    const alice = await register({ fullName: "Alice Adams" });
    const bob = await register({ fullName: "Bob Brown" });
    const direct = await as(alice.cookie)
      .post("/api/conversations/direct")
      .send({ userId: bob.user._id });

    const res = await as(alice.cookie)
      .patch(`/api/conversations/${direct.body._id}`)
      .send({ name: "Not allowed" });

    expect(res.status).toBe(400);
  });
});
