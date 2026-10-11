import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp({ rateLimit: false });

/** Create an account and return its cookie plus the public user object. */
export async function register(overrides = {}) {
  const unique = Math.random().toString(36).slice(2, 10);
  const payload = {
    fullName: "Test User",
    email: `${unique}@example.com`,
    password: "secret123",
    ...overrides,
  };

  const res = await request(app).post("/api/auth/signup").send(payload);
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    user: res.body,
    cookie: res.headers["set-cookie"],
    password: payload.password,
    email: payload.email,
  };
}

/** A supertest agent that already carries the given cookie. */
export function as(cookie) {
  const send = (method, url) => request(app)[method](url).set("Cookie", cookie);
  return {
    get: (url) => send("get", url),
    post: (url) => send("post", url),
    put: (url) => send("put", url),
    patch: (url) => send("patch", url),
    delete: (url) => send("delete", url),
  };
}

/** Open (or reuse) the direct chat between two people. */
export async function openDirect(from, otherId) {
  const res = await as(from.cookie).post("/api/conversations/direct").send({ userId: otherId });
  if (res.status !== 200) {
    throw new Error(`openDirect failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function createGroup(creator, name, memberIds) {
  const res = await as(creator.cookie)
    .post("/api/conversations/group")
    .send({ name, memberIds });
  if (res.status !== 201) {
    throw new Error(`createGroup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function say(from, conversationId, text) {
  const res = await as(from.cookie)
    .post(`/api/conversations/${conversationId}/messages`)
    .send({ text });
  if (res.status !== 201) {
    throw new Error(`say failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function listConversations(who) {
  const res = await as(who.cookie).get("/api/conversations");
  return res.body;
}

export async function findConversation(who, conversationId) {
  const all = await listConversations(who);
  return all.find((c) => String(c._id) === String(conversationId));
}
