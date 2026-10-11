import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ConnectionBanner from "../components/ConnectionBanner";

const HomePage = () => {
  const { selected } = useChatStore();

  return (
    <div className="h-screen bg-base-200">
      <ConnectionBanner />

      <div className="flex items-center justify-center pt-16 sm:pt-20 px-0 sm:px-4">
        <div className="bg-base-100 sm:rounded-lg shadow-lg w-full max-w-6xl h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)]">
          <div className="flex h-full sm:rounded-lg overflow-hidden">
            {/*
              On a phone there is only room for one pane, so the contact list
              and the conversation take turns. From `md` up both are visible.
              The old layout squeezed a 5rem icon strip next to the chat.
            */}
            <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
              <Sidebar />
            </div>

            <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
              {selected ? <ChatContainer /> : <NoChatSelected />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
