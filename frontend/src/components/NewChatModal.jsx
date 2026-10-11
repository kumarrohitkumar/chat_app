import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageSquare, Search, Users, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import Avatar from "./Avatar";

/** Pick one person for a direct chat, or several for a group. */
const NewChatModal = ({ onClose }) => {
  const { contacts, getContacts, openDirect, createGroup, findByEmail } = useChatStore();
  const [emailMatches, setEmailMatches] = useState([]);

  const [mode, setMode] = useState("direct");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [isBusy, setBusy] = useState(false);

  useEffect(() => {
    getContacts();
  }, [getContacts]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Contacts carry names only. A full email address is looked up on the
  // server, which returns that one person if they exist.
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  useEffect(() => {
    if (!looksLikeEmail) {
      setEmailMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findByEmail(query.trim());
      if (!cancelled) setEmailMatches(found);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, looksLikeEmail, findByEmail]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    if (looksLikeEmail) return emailMatches;
    return contacts.filter((c) => c.fullName.toLowerCase().includes(needle));
  }, [contacts, query, looksLikeEmail, emailMatches]);

  const toggle = (id) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const handleDirect = async (userId) => {
    setBusy(true);
    const ok = await openDirect(userId);
    setBusy(false);
    if (ok) onClose();
  };

  const handleGroup = async (event) => {
    event.preventDefault();
    setBusy(true);
    const ok = await createGroup({ name: groupName.trim(), memberIds: picked });
    setBusy(false);
    if (ok) onClose();
  };

  const canCreate = groupName.trim().length >= 2 && picked.length >= 1 && !isBusy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start a new chat"
        onClick={(event) => event.stopPropagation()}
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-fade-up"
      >
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="font-semibold text-lg">New chat</h2>
          <button onClick={onClose} aria-label="Close" className="press btn btn-ghost btn-sm btn-circle">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 pb-0">
          <div role="tablist" className="tabs tabs-boxed">
            <button
              role="tab"
              aria-selected={mode === "direct"}
              onClick={() => setMode("direct")}
              className={`tab gap-2 ${mode === "direct" ? "tab-active" : ""}`}
            >
              <MessageSquare className="size-4" />
              Direct
            </button>
            <button
              role="tab"
              aria-selected={mode === "group"}
              onClick={() => setMode("group")}
              className={`tab gap-2 ${mode === "group" ? "tab-active" : ""}`}
            >
              <Users className="size-4" />
              Group
            </button>
          </div>
        </div>

        <form onSubmit={handleGroup} className="flex flex-col min-h-0 flex-1">
          {mode === "group" && (
            <div className="p-4 pb-0 animate-slide-down">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                aria-label="Group name"
                maxLength={60}
                className="input input-bordered w-full transition-all focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, or type an exact email"
                aria-label="Search people"
                className="input input-sm input-bordered w-full pl-9"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-2 pb-2 min-h-[12rem]">
            {visible.map((person, index) => {
              const isPicked = picked.includes(person._id);
              return (
                <button
                  key={person._id}
                  type="button"
                  disabled={isBusy}
                  style={{ "--i": Math.min(index, 10) }}
                  onClick={() => (mode === "direct" ? handleDirect(person._id) : toggle(person._id))}
                  className={`stagger press w-full px-3 py-2.5 rounded-lg flex items-center gap-3 text-left hover:bg-base-200 ${
                    isPicked ? "bg-primary/10" : ""
                  }`}
                >
                  <Avatar src={person.profilePic} alt="" size="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{person.fullName}</div>
                  </div>
                  {mode === "group" && (
                    <span
                      className={`size-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isPicked ? "bg-primary border-primary text-primary-content" : "border-base-300"
                      }`}
                    >
                      {isPicked && <Check className="size-3" />}
                    </span>
                  )}
                </button>
              );
            })}

            {visible.length === 0 && (
              <p className="text-center text-sm text-base-content/50 py-8">
                {contacts.length === 0 ? "Nobody else has signed up yet" : looksLikeEmail ? "Nobody with that email" : "No match"}
              </p>
            )}
          </div>

          {mode === "group" && (
            <div className="p-4 border-t border-base-300 flex items-center justify-between gap-3">
              <span className="text-sm text-base-content/60">
                {picked.length === 0
                  ? "Pick at least one person"
                  : `${picked.length} selected`}
              </span>
              <button type="submit" disabled={!canCreate} className="press btn btn-primary btn-sm">
                {isBusy && <Loader2 className="size-4 animate-spin" />}
                Create group
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default NewChatModal;
