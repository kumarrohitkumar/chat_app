import { CheckCheck } from "lucide-react";

/** A small, looping preview of a group chat: what the app does, shown rather than told. */
const PREVIEW = [
  { side: "left", name: "Priya", text: "Frontend build is tagged and ready.", delay: 150 },
  { side: "left", name: "Arjun", text: "Migrations ran clean on staging.", delay: 650 },
  { side: "right", text: "Perfect. Ship it at 4 🚀", delay: 1150, seen: "Seen by all" },
];

const Dot = ({ i }) => (
  <span className="size-1.5 rounded-full bg-base-content/50 animate-typing-dot" style={{ animationDelay: `${i * 160}ms` }} />
);

const AuthImagePattern = ({ title, subtitle }) => (
  <div className="hidden lg:flex items-center justify-center bg-base-200 p-12">
    <div className="w-full max-w-md">
      <div aria-hidden="true" className="rounded-3xl bg-base-100 shadow-2xl ring-1 ring-base-300 overflow-hidden mb-10">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-base-300">
          <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center font-bold">RC</div>
          <div>
            <div className="font-semibold leading-tight">Release Crew</div>
            <div className="text-xs text-success">4 members · 3 online</div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {PREVIEW.map((m) => (
            <div
              key={m.text}
              className={`flex flex-col ${m.side === "right" ? "items-end animate-bubble-in-right" : "items-start animate-bubble-in-left"}`}
              style={{ animationDelay: `${m.delay}ms` }}
            >
              {m.name && <span className="text-xs text-base-content/50 mb-1 ml-1">{m.name}</span>}
              <span className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] ${m.side === "right" ? "bg-primary text-primary-content rounded-br-md" : "bg-base-200 rounded-bl-md"}`}>
                {m.text}
              </span>
              {m.seen && (
                <span className="mt-1 mr-1 flex items-center gap-1 text-[11px] text-base-content/50">
                  <CheckCheck className="size-3.5 text-primary" /> {m.seen}
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 animate-bubble-in-left" style={{ animationDelay: "1700ms" }}>
            <span className="flex gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-base-200">
              <Dot i={0} />
              <Dot i={1} />
              <Dot i={2} />
            </span>
            <span className="text-xs text-base-content/50">Rahul is typing…</span>
          </div>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-3 text-center">{title}</h2>
      <p className="text-base-content/60 text-center">{subtitle}</p>
    </div>
  </div>
);

export default AuthImagePattern;
