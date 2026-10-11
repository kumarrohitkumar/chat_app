import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, CheckCheck, Loader2 } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import Avatar from "./Avatar";

import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime, formatDayLabel, isSameDay } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    loadOlderMessages,
    isMessagesLoading,
    isLoadingOlder,
    hasMore,
    selected,
    typingUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const previousHeightRef = useRef(0);

  // Messages already on screen when the chat opened should not fly in one by
  // one; only the ones that arrive afterwards get the entrance animation.
  const [settledCount, setSettledCount] = useState(0);
  const [showJump, setShowJump] = useState(false);

  const isGroup = selected.type === "group";
  const otherMemberCount = selected.members.length - 1;

  useEffect(() => {
    setSettledCount(0);
    if (selected?._id) getMessages(selected._id);
  }, [selected?._id, getMessages]);

  useEffect(() => {
    if (isMessagesLoading) return undefined;
    const id = requestAnimationFrame(() => setSettledCount(messages.length));
    return () => cancelAnimationFrame(id);
  }, [messages.length, isMessagesLoading]);

  // Stick to the bottom for new messages, but hold position when an older
  // page is prepended — otherwise reading history yanks you back down.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (isLoadingOlder) {
      previousHeightRef.current = container.scrollHeight;
      return;
    }

    if (previousHeightRef.current) {
      container.scrollTop = container.scrollHeight - previousHeightRef.current;
      previousHeightRef.current = 0;
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingOlder, typingUsers]);

  const handleScroll = (event) => {
    const el = event.currentTarget;

    if (el.scrollTop < 80 && hasMore && !isLoadingOlder) loadOlderMessages();

    // Reading history should not be interrupted, so offer a way back down
    // instead of scrolling for them.
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 320);
  };

  const jumpToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  /** "Sent", "Seen", or "Seen by 3" once more than one person has caught up. */
  const receipt = (message) => {
    const readBy = message.readBy ?? 0;
    if (readBy === 0) return { icon: <Check className="size-3.5" />, label: "Sent" };
    if (!isGroup || otherMemberCount === 1) {
      return { icon: <CheckCheck className="size-3.5 text-primary" />, label: "Seen" };
    }
    return {
      icon: <CheckCheck className="size-3.5 text-primary" />,
      label: readBy >= otherMemberCount ? "Seen by all" : `Seen by ${readBy}`,
    };
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        {/* Same key in both layouts, so React keeps the composer (and what
            the user is typing) while messages load. */}
        <MessageInput key="composer" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />

      {showJump && (
        <button
          onClick={jumpToBottom}
          aria-label="Jump to the latest message"
          className="press absolute bottom-24 right-5 z-10 btn btn-circle btn-sm btn-primary shadow-lg animate-pop"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-5 animate-spin text-base-content/40" />
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <p className="text-center text-xs text-base-content/40 py-2">
            {isGroup
              ? `This is the beginning of ${selected.name}`
              : `This is the start of your conversation with ${selected.name}`}
          </p>
        )}

        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center animate-fade-in">
            <p className="text-base-content/50 text-sm">
              No messages yet. Say hello to {selected.name}.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDayLabel = !previous || !isSameDay(previous.createdAt, message.createdAt);
          const isNew = index >= settledCount;

          // System notes ("Ravi added Priya") are a centred line, not a bubble.
          if (message.system) {
            return (
              <div key={message._id} className={isNew ? "animate-fade-in" : undefined}>
                {showDayLabel && (
                  <div className="flex justify-center my-4 animate-fade-in">
                    <span className="text-[11px] uppercase tracking-wide text-base-content/50 bg-base-200 px-3 py-1 rounded-full">
                      {formatDayLabel(message.createdAt)}
                    </span>
                  </div>
                )}
                <p className="text-center text-xs text-base-content/50 italic py-1">
                  {message.text}
                </p>
              </div>
            );
          }

          const isMine = message.senderId === authUser._id;
          const sender = selected.members.find((m) => m._id === message.senderId);
          // In a group, only label the first of a run from the same person.
          const showSenderName =
            isGroup && !isMine && (!previous || previous.senderId !== message.senderId);
          const { icon, label } = receipt(message);

          return (
            <div
              key={message._id}
              className={
                isNew ? (isMine ? "animate-bubble-in-right" : "animate-bubble-in-left") : undefined
              }
            >
              {showDayLabel && (
                <div className="flex justify-center my-4 animate-fade-in">
                  <span className="text-[11px] uppercase tracking-wide text-base-content/50 bg-base-200 px-3 py-1 rounded-full">
                    {formatDayLabel(message.createdAt)}
                  </span>
                </div>
              )}

              <div className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
                <div className="chat-image avatar">
                  <div className="size-10 rounded-full border border-base-300">
                    <Avatar
                      src={isMine ? authUser.profilePic : sender?.profilePic}
                      alt=""
                      size="size-10"
                    />
                  </div>
                </div>

                <div className="chat-header mb-1 flex items-center gap-2">
                  {showSenderName && (
                    <span className="text-xs font-medium opacity-70">
                      {sender?.fullName ?? "Unknown"}
                    </span>
                  )}
                  <time className="text-xs opacity-50">{formatMessageTime(message.createdAt)}</time>
                </div>

                <div className="chat-bubble flex flex-col gap-1 transition-shadow hover:shadow-md">
                  {message.image && (
                    <a href={message.image} target="_blank" rel="noreferrer">
                      <img
                        src={message.image}
                        alt="Attachment"
                        loading="lazy"
                        className="sm:max-w-[220px] rounded-md transition-transform duration-300 hover:scale-[1.03]"
                      />
                    </a>
                  )}
                  {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                </div>

                {isMine && (
                  <div className="chat-footer opacity-50 text-xs flex items-center gap-1 mt-0.5">
                    <span className="flex items-center gap-1 animate-fade-in">
                      {icon}
                      {label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="animate-bubble-in-left">
            <TypingIndicator
              users={typingUsers
                .map((id) => selected.members.find((m) => m._id === id))
                .filter(Boolean)}
            />
          </div>
        )}

        {/* A single sentinel. The old code put the scroll ref on every
            message, so it always jumped to whichever rendered last. */}
        <div ref={bottomRef} />
      </div>

      <MessageInput key="composer" />
    </div>
  );
};

export default ChatContainer;
