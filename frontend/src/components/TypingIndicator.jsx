import Avatar from "./Avatar";

const TypingIndicator = ({ users }) => {
  if (users.length === 0) return null;

  return (
    <div className="chat chat-start">
      <div className="chat-image avatar">
        <div className="size-10 rounded-full border border-base-300">
          <Avatar src={users[0].profilePic} alt="" size="size-10" />
        </div>
      </div>
      <div className="chat-bubble flex items-center gap-1.5 py-3">
        <span className="sr-only">
          {users.map((u) => u.fullName).join(", ")} {users.length === 1 ? "is" : "are"} typing
        </span>
        {[0, 180, 360].map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-current animate-typing-dot"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

export default TypingIndicator;
