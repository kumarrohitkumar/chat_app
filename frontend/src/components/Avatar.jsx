import { Users } from "lucide-react";

/**
 * One avatar for both kinds of row. A group with no picture falls back to an
 * icon rather than the generic person placeholder.
 */
const Avatar = ({ src, alt = "", isGroup = false, size = "size-12", className = "" }) => {
  if (!src && isGroup) {
    return (
      <div
        className={`${size} ${className} rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0`}
      >
        <Users className="size-1/2" />
      </div>
    );
  }

  return (
    <img
      src={src || "/avatar.png"}
      alt={alt}
      className={`${size} ${className} object-cover rounded-full shrink-0`}
    />
  );
};

export default Avatar;
