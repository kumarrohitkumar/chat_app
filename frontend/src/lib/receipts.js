/**
 * Someone read a conversation up to `at`, having previously read up to
 * `previousAt`. Count them once on each of my messages they have now seen for
 * the first time: sent after their previous read, and no later than this one.
 */
export function applyRead(messages, myId, { at, previousAt }) {
  const upTo = new Date(at).getTime();
  const from = previousAt ? new Date(previousAt).getTime() : -Infinity;
  return messages.map((m) => {
    if (m.senderId !== myId) return m;
    const sent = new Date(m.createdAt).getTime();
    return sent > from && sent <= upTo ? { ...m, readBy: (m.readBy ?? 0) + 1 } : m;
  });
}

/** Merge a fresh page of messages into what is on screen, without duplicates, oldest first. */
export function mergeMessages(current, fresh) {
  const byId = new Map(current.map((m) => [m._id, m]));
  for (const m of fresh) byId.set(m._id, m);
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
