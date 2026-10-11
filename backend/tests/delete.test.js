import { describe, expect, it } from "vitest";
import { as, createGroup, findConversation, listConversations, openDirect, register, say } from "./helpers.js";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==";

const messagesOf = async (who, conversationId) =>
  (await as(who.cookie).get(`/api/conversations/${conversationId}/messages`)).body.messages;

describe("deleting a message", () => {
  it("lets the sender delete it for everyone, leaving a 'deleted' placeholder", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    const msg = await say(a, chat._id, "oops, wrong chat");

    const res = await as(a.cookie).delete(`/api/conversations/${chat._id}/messages/${msg._id}`);
    expect(res.status).toBe(200);

    const [seenByB] = await messagesOf(b, chat._id);
    expect(seenByB).toMatchObject({ _id: msg._id, deleted: true, text: "" });
    expect(seenByB.image).toBeFalsy();
    expect((await findConversation(b, chat._id)).lastMessage).toMatchObject({ deleted: true, text: "" });
  });

  it("removes the photo of a deleted photo message", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    const sent = await as(a.cookie).post(`/api/conversations/${chat._id}/messages`).send({ image: PNG });
    await as(a.cookie).delete(`/api/conversations/${chat._id}/messages/${sent.body._id}`).expect(200);
    expect((await as(b.cookie).get(sent.body.image)).status).toBe(404);
  });

  it("does not let anyone else delete it, and is safe to repeat", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    const msg = await say(a, chat._id, "mine");
    expect((await as(b.cookie).delete(`/api/conversations/${chat._id}/messages/${msg._id}`)).status).toBe(403);

    const outsider = await register();
    expect((await as(outsider.cookie).delete(`/api/conversations/${chat._id}/messages/${msg._id}`)).status).toBe(404);

    await as(a.cookie).delete(`/api/conversations/${chat._id}/messages/${msg._id}`).expect(200);
    await as(a.cookie).delete(`/api/conversations/${chat._id}/messages/${msg._id}`).expect(200);
    expect((await as(a.cookie).delete(`/api/conversations/${chat._id}/messages/64b000000000000000000000`)).status).toBe(404);
  });

  it("refuses to delete system notes", async () => {
    const a = await register();
    const b = await register();
    const group = await createGroup(a, "Team", [b.user._id]);
    const [note] = await messagesOf(a, group._id);
    expect(note.system).toBe(true);
    expect((await as(a.cookie).delete(`/api/conversations/${group._id}/messages/${note._id}`)).status).toBe(403);
  });
});

describe("deleting a chat (for me)", () => {
  it("hides the chat and its history for me only", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    await say(a, chat._id, "hello");
    await say(b, chat._id, "hi");

    expect((await as(a.cookie).delete(`/api/conversations/${chat._id}`)).status).toBe(200);
    expect((await listConversations(a)).map((c) => c._id)).not.toContain(chat._id);
    expect(await messagesOf(a, chat._id)).toEqual([]);

    // The other person keeps everything.
    expect((await messagesOf(b, chat._id)).map((m) => m.text)).toEqual(["hello", "hi"]);
    expect((await listConversations(b)).map((c) => c._id)).toContain(chat._id);
  });

  it("comes back with only new messages when someone writes again", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    await say(a, chat._id, "old");
    await as(a.cookie).delete(`/api/conversations/${chat._id}`).expect(200);

    await say(b, chat._id, "are you there?");
    const back = await findConversation(a, chat._id);
    expect(back).toBeTruthy();
    expect(back.unreadCount).toBe(1);
    expect((await messagesOf(a, chat._id)).map((m) => m.text)).toEqual(["are you there?"]);
  });

  it("reopening a deleted direct chat starts empty", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    await say(a, chat._id, "old");
    await as(a.cookie).delete(`/api/conversations/${chat._id}`).expect(200);

    const again = await openDirect(a, b.user._id);
    expect(again._id).toBe(chat._id);
    expect(await messagesOf(a, chat._id)).toEqual([]);
    expect((await listConversations(a)).map((c) => c._id)).toContain(chat._id);
  });

  it("works for a group without leaving it", async () => {
    const a = await register();
    const b = await register();
    const group = await createGroup(a, "Team", [b.user._id]);
    await say(b, group._id, "before");
    await as(a.cookie).delete(`/api/conversations/${group._id}`).expect(200);
    expect((await listConversations(a)).map((c) => c._id)).not.toContain(group._id);

    await say(b, group._id, "after");
    expect((await messagesOf(a, group._id)).map((m) => m.text)).toEqual(["after"]);
  });

  it("is only for members", async () => {
    const a = await register();
    const b = await register();
    const chat = await openDirect(a, b.user._id);
    const outsider = await register();
    expect((await as(outsider.cookie).delete(`/api/conversations/${chat._id}`)).status).toBe(404);
  });
});
