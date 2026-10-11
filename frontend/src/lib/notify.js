/**
 * New-message feedback for when the tab is not in front: a short tone and,
 * if the user has allowed it, a system notification.
 */

let audioContext = null;

/** A two-note chime, synthesised — no audio file to ship or fail to load. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    audioContext ||= new Ctx();
    // Browsers suspend audio until the user has interacted with the page.
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;

    [
      { frequency: 660, at: 0 },
      { frequency: 880, at: 0.1 },
    ].forEach(({ frequency, at }) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Fade in and out, or the tone clicks at both ends.
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(0.09, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + at);
      oscillator.stop(now + at + 0.24);
    });
  } catch {
    // Sound is a nicety; never let it break message delivery.
  }
}

export function canRequestNotifications() {
  return typeof Notification !== "undefined" && Notification.permission === "default";
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showMessageNotification({ title, body, icon }) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || "/favicon.svg",
      // One notification per sender, replaced rather than stacked.
      tag: `chatify-${title}`,
      renotify: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers throw for notifications outside a service worker.
  }
}
