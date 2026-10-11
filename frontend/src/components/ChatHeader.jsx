import { useState } from "react";
import { ArrowLeft, Info, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupInfoPanel from "./GroupInfoPanel";
import Avatar from "./Avatar";

const ChatHeader = () => {
  const { selected, select, typingUsers } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [isInfoOpen, setInfoOpen] = useState(false);

  const isGroup = selected.type === "group";
  const isOnline = !isGroup && onlineUsers.includes(selected.otherUserId);

  const typingNames = typingUsers
    .map((id) => selected.members.find((m) => m._id === id)?.fullName?.split(" ")[0])
    .filter(Boolean);

  /** In a group, say who is typing; in a direct chat just "typing…". */
  const status = typingNames.length
    ? isGroup
      ? `${typingNames.slice(0, 2).join(", ")}${typingNames.length > 2 ? " and others" : ""} typing…`
      : "typing…"
    : isGroup
      ? `${selected.members.length} members · ${
          selected.members.filter((m) => m._id !== authUser?._id && onlineUsers.includes(m._id))
            .length
        } online`
      : isOnline
        ? "Online"
        : "Offline";

  return (
    <>
      <div className="p-3 border-b border-base-300 bg-base-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* On a phone the conversation replaces the list, so there has to
                be a way back to it. */}
            <button
              onClick={() => select(null)}
              aria-label="Back to chats"
              className="press btn btn-ghost btn-sm btn-circle md:hidden"
            >
              <ArrowLeft className="size-5" />
            </button>

            <button
              onClick={() => isGroup && setInfoOpen(true)}
              disabled={!isGroup}
              className={`flex items-center gap-2 min-w-0 text-left rounded-lg px-1 py-0.5 ${
                isGroup ? "press hover:bg-base-200" : "cursor-default"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar src={selected.image} isGroup={isGroup} alt="" size="size-10" />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 size-3 rounded-full bg-success ring-2 ring-base-100" />
                )}
              </div>

              <div className="min-w-0">
                <h3 className="font-medium truncate">{selected.name}</h3>
                <p
                  className={`text-sm truncate ${
                    typingNames.length ? "text-primary" : "text-base-content/60"
                  }`}
                >
                  {status}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {isGroup && (
              <button
                onClick={() => setInfoOpen(true)}
                aria-label="Group details"
                className="press btn btn-ghost btn-sm btn-circle"
              >
                <Info className="size-5" />
              </button>
            )}

            <button
              onClick={() => select(null)}
              aria-label="Close conversation"
              className="press btn btn-ghost btn-sm btn-circle hidden md:inline-flex"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {isInfoOpen && isGroup && (
        <GroupInfoPanel conversation={selected} onClose={() => setInfoOpen(false)} />
      )}
    </>
  );
};

export default ChatHeader;
