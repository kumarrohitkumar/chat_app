export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "Today", "Yesterday", or a date — used for the separators between days. */
export function formatDayLabel(date) {
  const day = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(day, today)) return "Today";
  if (sameDay(day, yesterday)) return "Yesterday";

  return day.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function isSameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Compact stamp for the contact list: 14:05 today, "Mon", or 4 Mar. */
export function formatRelativeTime(date) {
  const when = new Date(date);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = now - when;

  if (when.toDateString() === now.toDateString()) {
    return when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (elapsed < 7 * dayMs) {
    return when.toLocaleDateString([], { weekday: "short" });
  }
  return when.toLocaleDateString([], { day: "numeric", month: "short" });
}
