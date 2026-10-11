/** Alternating placeholder bubbles while a conversation loads. */
const MessageSkeleton = () => (
  <div className="flex-1 overflow-hidden p-4 space-y-4">
    {Array.from({ length: 6 }).map((_, index) => {
      const isMine = index % 2 === 1;
      return (
        <div
          key={index}
          style={{ "--i": index }}
          className={`stagger chat ${isMine ? "chat-end" : "chat-start"}`}
        >
          <div className="chat-image avatar">
            <div className="size-10 rounded-full">
              <div className="skeleton shimmer size-full rounded-full" />
            </div>
          </div>
          <div className="chat-header mb-1">
            <div className="skeleton shimmer h-3 w-14 rounded" />
          </div>
          <div
            className="skeleton shimmer h-11 rounded-2xl"
            style={{ width: `${130 + ((index * 47) % 150)}px` }}
          />
        </div>
      );
    })}
  </div>
);

export default MessageSkeleton;
