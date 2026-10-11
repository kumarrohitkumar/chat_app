import { create } from "zustand";

const STORAGE_KEY = "chat-theme";
const DEFAULT_THEME = "night";

/** localStorage throws in private windows and when site data is blocked. */
function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export const useThemeStore = create((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies for this session; it just will not be remembered.
    }
    set({ theme });
  },
}));
