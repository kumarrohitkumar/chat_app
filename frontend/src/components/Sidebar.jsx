import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, MessageSquarePlus, Search, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import NewChatModal from "./NewChatModal";
import Avatar from "./Avatar";
import { formatRelativeTime } from "../lib/utils";

const Sidebar = () => {
  const { getConversations, conversations, selected, select, isListLoading } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  const [query, setQuery] = useState("");
  const [isNewChatOpen, setNewChatOpen] = useState(false);

  useEffect(() => {
    getConversations();
  }, [getConversations]);

  const othersOnline = useMemo(
    () => onlineUsers.filter((id) => id !== authUser?._id).length,
    [onlineUsers, authUser?._id]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.members.some((m) => m.fullName.toLowerCase().includes(needle))
    );
  }, [conversations, query]);

  if (isListLoading && conversations.length === 0) return <SidebarSkeleton />;

  return (
    <>
      <aside className="h-full w-full md:w-80 border-r border-base-300 flex flex-col animate-fade-in">
        <div className="border-b border-base-300 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Chats</span>
              <span className="text-xs text-base-content/50">{othersOnline} online</span>
            </div>

            <button
              onClick={() => setNewChatOpen(true)}
              aria-label="Start a new chat"
              className="press btn btn-primary btn-sm btn-circle"
            >
              <MessageSquarePlus className="size-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="input input-sm input-bordered w-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 py-1">
          {visible.map((conversation, index) => {
            const isGroup = conversation.type === "group";
            const isOnline = !isGroup && onlineUsers.includes(conversation.otherUserId);
            const unread = conversation.unreadCount ?? 0;
            const last = conversation.lastMessage;

            const sender = last?.senderId
              ? conversation.members.find((m) => m._id === String(last.senderId))
              : null;

            // "You: …" in a direct chat, "Priya: …" in a group.
            const prefix = last?.system
              ? ""
              : last?.senderId === authUser?._id
                ? "You: "
                : isGroup && sender
                  ? `${sender.fullName.split(" ")[0]}: `
                  : "";

            const preview = last?.deleted
              ? last.senderId === authUser?._id
                ? "You deleted a message"
                : "Message deleted"
              : last?.hasImage
              ? `${prefix}Photo`
              : last?.text
                ? `${prefix}${last.text}`
                : "No messages yet";

            return (
              <button
                key={conversation._id}
                onClick={() => select(conversation)}
                style={{ "--i": Math.min(index, 12) }}
                className={`contact-row stagger press w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200 text-left ${
                  selected?._id === conversation._id ? "bg-base-200" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={conversation.image}
                    alt=""
                    isGroup={isGroup}
                    className="contact-avatar"
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 size-3">
                      <span className="absolute inset-0 rounded-full bg-success animate-ping-soft" />
                      <span className="absolute inset-0 rounded-full bg-success ring-2 ring-base-100" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium truncate flex items-center gap-1.5">
                      {isGroup && <Users className="size-3.5 opacity-50 shrink-0" />}
                      {conversation.name}
                    </span>
                    {conversation.lastMessageAt && (
                      <span className="text-[11px] text-base-content/40 shrink-0">
                        {formatRelativeTime(conversation.lastMessageAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span
                      className={`text-sm truncate flex items-center gap-1 ${
                        unread > 0 ? "text-base-content font-medium" : "text-base-content/50"
                      } ${last?.system ? "italic" : ""}`}
                    >
                      {last?.hasImage && <ImageIcon className="size-3.5 shrink-0" />}
                      <span className="truncate">{preview}</span>
                    </span>

                    {unread > 0 && (
                      <span key={unread} className="badge badge-primary badge-sm shrink-0 animate-pop">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {visible.length === 0 && (
            <div className="text-center text-base-content/50 text-sm py-8 px-4 animate-fade-in space-y-3">
              <p>{query ? "Nothing matches that search" : "No chats yet"}</p>
              {!query && (
                <button onClick={() => setNewChatOpen(true)} className="press btn btn-sm btn-primary">
                  Start one
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {isNewChatOpen && <NewChatModal onClose={() => setNewChatOpen(false)} />}
    </>
  );
};

export default Sidebar;
