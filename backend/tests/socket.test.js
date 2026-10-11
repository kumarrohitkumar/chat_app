import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "http";
import { io as connect } from "socket.io-client";
import { createApp } from "../src/app.js";
import { initSocket, closeSocket } from "../src/lib/socket.js";
import { as, createGroup, register, say } from "./helpers.js";

let server;
let url;

beforeAll(async () => {
  server = http.createServer(createApp({ rateLimit: false }));
  initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await closeSocket();
  await new Promise((resolve) => server.close(resolve));
});

/** Resolves to "connected" or the rejection reason. */
function attempt(options) {
  return new Promise((resolve) => {
    const socket = connect(url, { ...options, reconnection: false, timeout: 4000 });
    const finish = (result) => {
      socket.close();
      resolve(result);
    };
    socket.on("connect", () => finish("connected"));
    socket.on("connect_error", (error) => finish(error.message));
    setTimeout(() => finish("timeout"), 6000);
  });
}

describe("socket authentication", () => {
  it("rejects a connection with no cookie", async () => {
    expect(await attempt({})).toBe("unauthorized");
  });

  it("rejects a userId supplied in the query string", async () => {
    // This was the original hole: the server trusted whatever id the browser
    // sent, so anyone could appear online as anyone else.
    const { user } = await register();

    const result = await attempt({ query: { userId: user._id } });

    expect(result).toBe("unauthorized");
  });

  it("rejects a cookie signed with a different secret", async () => {
    const forged = "jwt=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.bad-signature";

    expect(await attempt({ extraHeaders: { Cookie: forged } })).toBe("unauthorized");
  });

  it("accepts a real signed cookie", async () => {
    const { cookie } = await register();
    const jwtCookie = cookie.find((c) => c.startsWith("jwt=")).split(";")[0];

    expect(await attempt({ extraHeaders: { Cookie: jwtCookie } })).toBe("connected");
  });
});

/** Open an authenticated socket and wait until it is connected. */
async function open(cookie) {
  const jwtCookie = cookie.find((c) => c.startsWith("jwt=")).split(";")[0];
  const socket = connect(url, { extraHeaders: { Cookie: jwtCookie }, reconnection: false });
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });
  return socket;
}

/** Wait for a presence broadcast that satisfies `predicate`. */
function waitForPresence(socket, predicate, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const handler = (ids) => {
      if (!predicate(ids)) return;
      socket.off("getOnlineUsers", handler);
      resolve(ids);
    };
    socket.on("getOnlineUsers", handler);
    setTimeout(() => {
      socket.off("getOnlineUsers", handler);
      resolve(null);
    }, timeoutMs);
  });
}

describe("presence", () => {
  it("tells everyone when a user comes online and goes offline", async () => {
    const watcher = await register();
    const subject = await register();

    const watcherSocket = await open(watcher.cookie);

    const appeared = waitForPresence(watcherSocket, (ids) => ids.includes(subject.user._id));
    const subjectSocket = await open(subject.cookie);
    expect(await appeared).not.toBeNull();

    const disappeared = waitForPresence(watcherSocket, (ids) => !ids.includes(subject.user._id));
    subjectSocket.close();
    expect(await disappeared).not.toBeNull();

    watcherSocket.close();
  });

  it("keeps a user online while any of their tabs is still open", async () => {
    const watcher = await register();
    const subject = await register();

    const watcherSocket = await open(watcher.cookie);

    const tabOne = await open(subject.cookie);
    const tabTwo = await open(subject.cookie);

    // Closing one tab must not take the user offline — the old single-socket
    // map did exactly that.
    const afterOneClosed = waitForPresence(watcherSocket, () => true, 2500);
    tabOne.close();
    const ids = await afterOneClosed;

    expect(ids).not.toBeNull();
    expect(ids).toContain(subject.user._id);

    tabTwo.close();
    watcherSocket.close();
  });
});

/** Wait for a named event, or null if it never arrives. */
function waitFor(socket, event, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const handler = (payload) => {
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);
  });
}

describe("conversation rooms", () => {
  it("delivers a group message to every member's socket", async () => {
    const owner = await register({ fullName: "Room Owner" });
    const member = await register({ fullName: "Room Member" });
    const group = await createGroup(owner, "Sockets", [member.user._id]);

    // Connect after the group exists, so the socket joins its room on login.
    const memberSocket = await open(member.cookie);

    const delivered = waitFor(memberSocket, "newMessage");
    await say(owner, group._id, "over the wire");

    const message = await delivered;
    expect(message).not.toBeNull();
    expect(message.text).toBe("over the wire");

    memberSocket.close();
  });

  it("does not leak a group message to someone outside it", async () => {
    const owner = await register({ fullName: "Room Owner" });
    const member = await register({ fullName: "Room Member" });
    const outsider = await register({ fullName: "Room Outsider" });
    const group = await createGroup(owner, "Private", [member.user._id]);

    const outsiderSocket = await open(outsider.cookie);

    const leaked = waitFor(outsiderSocket, "newMessage", 2000);
    await say(owner, group._id, "internal only");

    expect(await leaked).toBeNull();

    outsiderSocket.close();
  });

  it("starts delivering to someone the moment they are added", async () => {
    const owner = await register({ fullName: "Room Owner" });
    const member = await register({ fullName: "Room Member" });
    const joiner = await register({ fullName: "Late Joiner" });
    const group = await createGroup(owner, "Growing", [member.user._id]);

    // Already connected, and not yet in the group.
    const joinerSocket = await open(joiner.cookie);

    await as(owner.cookie)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [joiner.user._id] });

    const delivered = waitFor(joinerSocket, "newMessage");
    await say(owner, group._id, "welcome aboard");

    const message = await delivered;
    expect(message).not.toBeNull();
    expect(message.text).toBe("welcome aboard");

    joinerSocket.close();
  });

  it("stops delivering the moment someone is removed", async () => {
    const owner = await register({ fullName: "Room Owner" });
    const member = await register({ fullName: "Room Member" });
    const leaver = await register({ fullName: "Leaving Soon" });
    const group = await createGroup(owner, "Shrinking", [member.user._id, leaver.user._id]);

    const leaverSocket = await open(leaver.cookie);

    await as(owner.cookie).delete(
      `/api/conversations/${group._id}/members/${leaver.user._id}`
    );

    const leaked = waitFor(leaverSocket, "newMessage", 2000);
    await say(owner, group._id, "they should not see this");

    expect(await leaked).toBeNull();

    leaverSocket.close();
  });
});
