import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Camera, Check, LogOut, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import Avatar from "./Avatar";

/** Members, rename, add and remove — everything a group needs after creation. */
const GroupInfoPanel = ({ conversation, onClose }) => {
  const { contacts, getContacts, renameGroup, updateGroup, addMembers, removeMember } = useChatStore();
  const [confirming, setConfirming] = useState(null); // { member } or { leave: true }
  const [isUploading, setUploading] = useState(false);
  const photoInput = useRef(null);

  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Please choose an image under 5 MB");
    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      await updateGroup(conversation._id, { name: conversation.name, image: reader.result });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const membersLeftIfILeave = conversation.members.length - 1;
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
            <div className="relative shrink-0">
              <Avatar src={conversation.image} isGroup alt="" />
              {conversation.isAdmin && (
                <>
                  <input ref={photoInput} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
                  <button
                    onClick={() => photoInput.current?.click()}
                    disabled={isUploading}
                    aria-label="Change group photo"
                    className="press absolute -bottom-1 -right-1 btn btn-xs btn-circle btn-primary"
                  >
                    {isUploading ? <span className="loading loading-spinner loading-xs" /> : <Camera className="size-3" />}
                  </button>
                </>
              )}
            </div>
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
                    <div className="text-xs text-base-content/50 truncate">
                      {onlineUsers.includes(member._id) ? "Online" : "Offline"}
                    </div>
                  </div>

                  {member.role === "admin" && (
                    <span className="badge badge-sm badge-ghost shrink-0">admin</span>
                  )}

                  {conversation.isAdmin && !isMe && (
                    <button
                      onClick={() => setConfirming({ member })}
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

        {confirming && (
          <div role="alertdialog" aria-label="Confirm" className="mx-4 mb-0 mt-2 p-3 rounded-xl bg-error/10 text-sm animate-slide-down">
            <p className="font-medium">
              {confirming.leave
                ? membersLeftIfILeave < 2
                  ? "Leave and delete this group? It has no one else left, so its messages will be deleted for everyone."
                  : "Leave this group? You will stop getting its messages."
                : `Remove ${confirming.member.fullName} from the group?`}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setConfirming(null)} className="press btn btn-ghost btn-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = confirming.leave ? authUser._id : confirming.member._id;
                  setConfirming(null);
                  await removeMember(conversation._id, target);
                  if (confirming.leave) onClose();
                }}
                className="press btn btn-error btn-xs"
              >
                {confirming.leave ? (membersLeftIfILeave < 2 ? "Leave and delete" : "Leave") : "Remove"}
              </button>
            </div>
          </div>
        )}

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
              onClick={() => setConfirming({ leave: true })}
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
