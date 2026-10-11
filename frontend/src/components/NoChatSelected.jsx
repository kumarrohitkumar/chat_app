import { MessageSquare } from "lucide-react";

const NoChatSelected = () => (
  <div className="w-full flex flex-1 flex-col items-center justify-center p-8 sm:p-16 bg-base-100/50">
    <div className="max-w-md text-center space-y-5 animate-fade-up">
      <div className="relative size-16 mx-auto">
        {/* A slow halo, so the empty state is not completely still. */}
        <span className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping-soft" />
        <div className="relative size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="size-8 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-bold">Welcome to Chatify</h2>
      <p className="text-base-content/60">
        Pick someone from the list to start a conversation. Messages arrive instantly — no
        refreshing.
      </p>
    </div>
  </div>
);

export default NoChatSelected;
