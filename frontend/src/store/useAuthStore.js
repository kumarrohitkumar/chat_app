import { create } from "zustand";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { axiosInstance, apiError } from "../lib/axios.js";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch {
      // A 401 here is the normal "not signed in yet" case, not an error.
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      get().connectSocket();
      toast.success("Welcome to Chatify");
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not create the account"));
      return false;
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      get().connectSocket();
      toast.success(`Signed in as ${res.data.fullName}`);
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not sign in"));
      return false;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      toast.error(apiError(error, "Could not sign out cleanly"));
    } finally {
      // Clear locally either way — the user asked to leave.
      get().disconnectSocket();
      set({ authUser: null, onlineUsers: [] });
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(apiError(error, "Could not update the profile"));
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  /**
   * The server reads the identity from the auth cookie, so nothing about who
   * we are is sent from here — the browser cannot claim to be someone else.
   */
  connectSocket: () => {
    const { authUser, socket } = get();
    // An existing socket, even one still connecting, is reused: checking only
    // `connected` used to open a second socket during the handshake.
    if (!authUser || socket) return;

    const next = io({ withCredentials: true, autoConnect: true });

    next.on("getOnlineUsers", (userIds) => set({ onlineUsers: userIds }));
    next.on("connect_error", () => {
      // Usually an expired cookie. checkAuth on the next load will clear it.
    });

    set({ socket: next });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (!socket) return;

    socket.removeAllListeners();
    socket.disconnect();
    set({ socket: null });
  },
}));
