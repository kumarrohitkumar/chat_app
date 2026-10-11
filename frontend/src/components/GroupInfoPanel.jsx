import { useEffect, useMemo, useState } from "react";
import { Check, LogOut, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";

/** Members, rename, add and remove — everything a group needs after creation. */
const GroupInfoPanel = ({ conversation, onClose }) => {
  const { contacts, getContacts, renameGroup, addMembers, removeMember } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();

  const [isRenaming, setRenaming] = useState(false);
  const [name, setName] = useState(conversation.name);
  const [isAdding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (isAdding) getContacts();
  }, [isAdding, getContacts]);

  const memberIds = useMemo(
    () => new Set(conversation.members.map((m) => m._id)),
    [conversation.members]
  );
  const addable = contacts.filter((c) => !memberIds.has(c._id));

  const submitRename = async (event) => {
    event.preventDefault();
    if (await renameGroup(conversation._id, name.trim())) setRenaming(false);
  };

  const submitAdd = async () => {
    if (await addMembers(conversation._id, picked)) {
      setPicked([]);
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Group details"
        onClick={(event) => event.stopPropagation()}
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-fade-up"
      >
        <div className="p-4 border-b border-base-300 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={conversation.image} isGroup alt="" />
            <div className="min-w-0">
              {isRenaming ? (
                <form onSubmit={submitRename} className="flex items-center gap-1">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-label="Group name"
                    maxLength={60}
                    autoFocus
                    className="input input-sm input-bordered"
                  />
                  <button type="submit" aria-label="Save name" className="press btn btn-sm btn-circle btn-primary">
                    <Check className="size-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-semibold text-lg truncate">{conversation.name}</h2>
                  {conversation.isAdmin && (
                    <button
                      onClick={() => setRenaming(true)}
                      aria-label="Rename group"
                      className="press btn btn-ghost btn-xs btn-circle"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-base-content/50">
                {conversation.members.length} members
              </p>
            </div>
          </div>

          <button onClick={onClose} aria-label="Close" className="press btn btn-ghost btn-sm btn-circle">
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {!isAdding &&
            conversation.members.map((member, index) => {
              const isMe = member._id === authUser?._id;
              return (
                <div
                  key={member._id}
                  style={{ "--i": Math.min(index, 10) }}
                  className="stagger px-3 py-2.5 rounded-lg flex items-center gap-3 hover:bg-base-200"
                >
                  <div className="relative shrink-0">
                    <Avatar src={member.profilePic} alt="" size="size-10" />
                    {onlineUsers.includes(member._id) && (
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-base-100" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {member.fullName}
                      {isMe && <span className="text-base-content/40 font-normal"> (you)</span>}
                    </div>
                    <div className="text-xs text-base-content/50 truncate">{member.email}</div>
                  </div>

                  {member.role === "admin" && (
                    <span className="badge badge-sm badge-ghost shrink-0">admin</span>
                  )}

                  {conversation.isAdmin && !isMe && (
                    <button
                      onClick={() => removeMember(conversation._id, member._id)}
                      aria-label={`Remove ${member.fullName}`}
                      className="press btn btn-ghost btn-xs btn-circle text-error"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}

          {isAdding && (
            <div className="animate-slide-down">
              {addable.map((person) => {
                const isPicked = picked.includes(person._id);
                return (
                  <button
                    key={person._id}
                    onClick={() =>
                      setPicked((current) =>
                        isPicked ? current.filter((x) => x !== person._id) : [...current, person._id]
                      )
                    }
                    className={`press w-full px-3 py-2.5 rounded-lg flex items-center gap-3 text-left hover:bg-base-200 ${
                      isPicked ? "bg-primary/10" : ""
                    }`}
                  >
                    <Avatar src={person.profilePic} alt="" size="size-10" />
                    <span className="flex-1 min-w-0 truncate font-medium">{person.fullName}</span>
                    <span
                      className={`size-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isPicked ? "bg-primary border-primary text-primary-content" : "border-base-300"
                      }`}
                    >
                      {isPicked && <Check className="size-3" />}
                    </span>
                  </button>
                );
              })}

              {addable.length === 0 && (
                <p className="text-center text-sm text-base-content/50 py-8">
                  Everyone you know is already in this group
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-base-300 flex items-center justify-between gap-2">
          {conversation.isAdmin &&
            (isAdding ? (
              <>
                <button
                  onClick={() => {
                    setAdding(false);
                    setPicked([]);
                  }}
                  className="press btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAdd}
                  disabled={picked.length === 0}
                  className="press btn btn-primary btn-sm"
                >
                  Add {picked.length > 0 && picked.length}
                </button>
              </>
            ) : (
              <button onClick={() => setAdding(true)} className="press btn btn-sm gap-2">
                <UserPlus className="size-4" />
                Add people
              </button>
            ))}

          {!isAdding && (
            <button
              onClick={() => removeMember(conversation._id, authUser._id)}
              className="press btn btn-sm btn-ghost text-error gap-2 ml-auto"
            >
              <LogOut className="size-4" />
              Leave group
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
