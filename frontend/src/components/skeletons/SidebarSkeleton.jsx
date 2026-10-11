import { Users } from "lucide-react";

/** Matches the real sidebar's dimensions exactly, so nothing jumps on load. */
const SidebarSkeleton = () => (
  <aside className="h-full w-full md:w-80 border-r border-base-300 flex flex-col">
    <div className="border-b border-base-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-5" />
        <span className="font-semibold">Contacts</span>
      </div>
      <div className="skeleton shimmer h-8 w-full rounded-lg" />
      <div className="skeleton shimmer h-5 w-28 rounded" />
    </div>

    <div className="overflow-hidden flex-1 py-1">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          style={{ "--i": index }}
          className="stagger w-full px-4 py-3 flex items-center gap-3"
        >
          <div className="skeleton shimmer size-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton shimmer h-4 rounded" style={{ width: `${45 + index * 6}%` }} />
            <div className="skeleton shimmer h-3 rounded" style={{ width: `${60 + index * 4}%` }} />
          </div>
        </div>
      ))}
    </div>
  </aside>
);

export default SidebarSkeleton;
