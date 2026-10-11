import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance, apiError } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore.js";
import { playChime, showMessageNotification } from "../lib/notify.js";
import { applyRead, mergeMessages } from "../lib/receipts.js";

const TYPING_IDLE_MS = 2000;

let typingTimer = null;

export const useChatStore = create((set, get) => ({
  conversations: [],
  contacts: [],
  messages: [],
  selected: null,
  isListLoading: false,
  isMessagesLoading: false,
  isLoadingOlder: false,
  isSending: false,
  hasMore: false,
  /** userIds currently typing in the open conversation. */
  typingUsers: [],

  getConversations: async () => {
    set({ isListLoading: true });
    try {
      const res = await axiosInstance.get("/conversations");
      set({ conversations: res.data });

      // Keep the open conversation's header in step with the list (name
      // changes, members added, someone leaving).
      const { selected } = get();
      if (selected) {
        const fresh = res.data.find((c) => c._id === selected._id);
        set({ selected: fresh ?? null });
      }
    } catch (error) {
      toast.error(apiError(error, "Could not load your chats"));
    } finally {
      set({ isListLoading: false });
    }
  },

  getContacts: async () => {
    try {
      const res = await axiosInstance.get("/conversations/contacts");
      set({ contacts: res.data });
    } catch (error) {
      toast.error(apiError(error, "Could not load contacts"));
    }
  },

  openDirect: async (userId) => {
    try {
      const res = await axiosInstance.post("/conversations/direct", { userId });
      await get().getConversations();
      get().select(res.data);
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not open that chat"));
      return false;
    }
  },

  createGroup: async ({ name, memberIds }) => {
    try {
      const res = await axiosInstance.post("/conversations/group", { name, memberIds });
      await get().getConversations();
      get().select(res.data);
      toast.success(`“${res.data.name}” created`);
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not create the group"));
      return false;
    }
  },

  /** Rename a group and/or change its photo (image is a data URL). */
  updateGroup: async (conversationId, { name, image }) => {
    try {
      await axiosInstance.patch(`/conversations/${conversationId}`, { name, ...(image ? { image } : {}) });
      await get().getConversations();
      toast.success(image ? "Group photo updated" : "Group renamed");
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not update the group"));
      return false;
    }
  },

  renameGroup: (conversationId, name) => get().updateGroup(conversationId, { name }),

  /** Find someone by their exact email (contacts no longer list emails). */
  findByEmail: async (email) => {
    try {
      const res = await axiosInstance.get("/conversations/contacts", { params: { email } });
      return res.data;
    } catch {
      return [];
    }
  },

  addMembers: async (conversationId, memberIds) => {
    try {
      const res = await axiosInstance.post(`/conversations/${conversationId}/members`, {
        memberIds,
      });
      await get().getConversations();
      toast.success(res.data.added === 1 ? "1 person added" : `${res.data.added} people added`);
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not add them"));
      return false;
    }
  },

  removeMember: async (conversationId, userId) => {
    const authUser = useAuthStore.getState().authUser;
    const isSelf = userId === authUser?._id;

    try {
      await axiosInstance.delete(`/conversations/${conversationId}/members/${userId}`);

      if (isSelf) set({ selected: null, messages: [] });
      await get().getConversations();

      toast.success(isSelf ? "You left the group" : "Removed");
      return true;
    } catch (error) {
      toast.error(apiError(error, "Could not do that"));
      return false;
    }
  },

  getMessages: async (conversationId) => {
    set({ isMessagesLoading: true, messages: [], hasMore: false });
    try {
      const res = await axiosInstance.get(`/conversations/${conversationId}/messages`);
      set({ messages: res.data.messages, hasMore: res.data.hasMore });
      get().markRead(conversationId);
    } catch (error) {
      toast.error(apiError(error, "Could not load the conversation"));
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  /** Scrolling up: fetch the page before the oldest message on screen. */
  loadOlderMessages: async () => {
    const { selected, messages, hasMore, isLoadingOlder } = get();
    if (!selected || !hasMore || isLoadingOlder || messages.length === 0) return;

    set({ isLoadingOlder: true });
    try {
      const res = await axiosInstance.get(`/conversations/${selected._id}/messages`, {
        params: { before: messages[0].createdAt },
      });
      set({ messages: [...res.data.messages, ...get().messages], hasMore: res.data.hasMore });
    } catch (error) {
      toast.error(apiError(error, "Could not load older messages"));
    } finally {
      set({ isLoadingOlder: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selected } = get();
    if (!selected) return false;

    set({ isSending: true });
    try {
      await axiosInstance.post(`/conversations/${selected._id}/messages`, messageData);
      // The server echoes the saved message to the whole room, including this
      // tab, so nothing is appended here.
      get().stopTyping();
      return true;
    } catch (error) {
      toast.error(apiError(error, "Message not sent"));
      return false;
    } finally {
      set({ isSending: false });
    }
  },

  markRead: async (conversationId) => {
    try {
      await axiosInstance.post(`/conversations/${conversationId}/read`);
      set({
        conversations: get().conversations.map((c) =>
          c._id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      });
    } catch {
      // A failed read receipt is not worth interrupting the user over.
    }
  },

  notifyTyping: () => {
    const { selected } = get();
    const socket = useAuthStore.getState().socket;
    if (!socket || !selected) return;

    socket.emit("typing", { conversationId: selected._id });

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => get().stopTyping(), TYPING_IDLE_MS);
  },

  stopTyping: () => {
    const { selected } = get();
    const socket = useAuthStore.getState().socket;
    clearTimeout(typingTimer);
    if (socket && selected) socket.emit("stopTyping", { conversationId: selected._id });
  },

  /**
   * One set of socket handlers for the whole session, attached once after
   * login rather than re-bound on every chat switch.
   */
  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage").on("newMessage", (message) => {
      const { selected, messages, conversations } = get();
      const authUser = useAuthStore.getState().authUser;
      const isOpen = selected && message.conversationId === selected._id;
      const isIncoming = !message.system && message.senderId !== authUser?._id;

      if (isOpen) {
        // The echo can arrive twice if a tab reconnects mid-send.
        if (!messages.some((m) => m._id === message._id)) {
          set({ messages: [...messages, message] });
        }
        if (isIncoming) get().markRead(message.conversationId);
      }

      const conversation = conversations.find((c) => c._id === message.conversationId);

      if (isIncoming && (document.hidden || !isOpen)) {
        playChime();

        if (document.hidden && conversation) {
          const sender = conversation.members.find((m) => m._id === message.senderId);
          showMessageNotification({
            // In a group, say which group it came from.
            title:
              conversation.type === "group"
                ? `${sender?.fullName ?? "Someone"} · ${conversation.name}`
                : sender?.fullName ?? "New message",
            body: message.text || "Sent a photo",
            icon: conversation.type === "group" ? undefined : sender?.profilePic,
          });
        }
      }

      if (!conversation) {
        // A conversation this tab has not seen yet — refetch the list.
        get().getConversations();
        return;
      }

      set({
        conversations: conversations
          .map((c) =>
            c._id === message.conversationId
              ? {
                  ...c,
                  lastMessageAt: message.createdAt,
                  lastMessage: {
                    text: message.text ?? "",
                    senderId: message.senderId ?? null,
                    hasImage: Boolean(message.image),
                    system: Boolean(message.system),
                  },
                  unreadCount: !isOpen && isIncoming ? (c.unreadCount ?? 0) + 1 : c.unreadCount ?? 0,
                }
              : c
          )
          .sort((a, b) => new Date(b.lastMessageAt ?? 0) - new Date(a.lastMessageAt ?? 0)),
      });
    });

    socket.off("userTyping").on("userTyping", ({ conversationId, from }) => {
      if (get().selected?._id !== conversationId) return;
      set({ typingUsers: [...new Set([...get().typingUsers, from])] });
    });

    socket.off("userStoppedTyping").on("userStoppedTyping", ({ conversationId, from }) => {
      if (get().selected?._id !== conversationId) return;
      set({ typingUsers: get().typingUsers.filter((id) => id !== from) });
    });

    socket.off("conversationRead").on("conversationRead", ({ conversationId, by, at, previousAt }) => {
      const authUser = useAuthStore.getState().authUser;
      if (get().selected?._id !== conversationId || by === authUser?._id) return;

      // Count this reader once, only on my messages they have now seen for the first time.
      set({ messages: applyRead(get().messages, authUser?._id, { at, previousAt }) });
    });

    const refresh = () => get().getConversations();
    socket.off("conversationCreated").on("conversationCreated", refresh);
    socket.off("conversationUpdated").on("conversationUpdated", refresh);

    // Removed from a group, or the group was deleted: drop it everywhere.
    socket.off("conversationRemoved").on("conversationRemoved", ({ conversationId, reason }) => {
      const wasOpen = get().selected?._id === conversationId;
      set({
        conversations: get().conversations.filter((c) => c._id !== conversationId),
        ...(wasOpen ? { selected: null, messages: [], typingUsers: [] } : {}),
      });
      if (wasOpen && reason !== "left") toast(reason === "deleted" ? "This group was deleted" : "You were removed from this group");
    });

    // After a dropped connection, fetch whatever was missed while offline.
    socket.io.off("reconnect").on("reconnect", () => get().resync());
  },

  resync: async () => {
    await get().getConversations();
    const { selected } = get();
    if (!selected) return;
    try {
      const res = await axiosInstance.get(`/conversations/${selected._id}/messages`);
      if (get().selected?._id !== selected._id) return;
      set({ messages: mergeMessages(get().messages, res.data.messages), typingUsers: [] });
      get().markRead(selected._id);
    } catch {
      // The banner already says we are reconnecting; the next event will retry.
    }
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket
      .off("newMessage")
      .off("userTyping")
      .off("userStoppedTyping")
      .off("conversationRead")
      .off("conversationCreated")
      .off("conversationUpdated")
      .off("conversationRemoved");
    socket.io.off("reconnect");
  },

  select: (conversation) => {
    get().stopTyping();
    set({ selected: conversation, typingUsers: [] });
  },
}));
