import { describe, expect, it } from "vitest";
import { applyRead, mergeMessages } from "./receipts.js";

const msg = (id, senderId, minute, readBy = 0) => ({ _id: id, senderId, createdAt: `2026-10-11T10:${String(minute).padStart(2, "0")}:00Z`, readBy });

describe("applyRead", () => {
  const messages = [msg("1", "me", 1), msg("2", "them", 2), msg("3", "me", 3), msg("4", "me", 5)];

  it("counts a first-time reader once on my messages up to their read time", () => {
    const out = applyRead(messages, "me", { at: "2026-10-11T10:04:00Z", previousAt: null });
    expect(out.map((m) => m.readBy)).toEqual([1, 0, 1, 0]);
  });

  it("does not count the same reader again for messages they had already read", () => {
    const once = applyRead(messages, "me", { at: "2026-10-11T10:04:00Z", previousAt: null });
    const twice = applyRead(once, "me", { at: "2026-10-11T10:06:00Z", previousAt: "2026-10-11T10:04:00Z" });
    expect(twice.map((m) => m.readBy)).toEqual([1, 0, 1, 1]);
  });
});

describe("mergeMessages", () => {
  it("adds missed messages in order and keeps no duplicates", () => {
    const merged = mergeMessages([msg("1", "a", 1), msg("2", "b", 2)], [msg("2", "b", 2), msg("3", "a", 3)]);
    expect(merged.map((m) => m._id)).toEqual(["1", "2", "3"]);
  });
});
