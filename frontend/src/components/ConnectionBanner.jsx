import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

/**
 * A websocket can drop without the page noticing — the app then looks fine
 * while messages silently stop arriving. This says so out loud.
 */
const ConnectionBanner = () => {
  const { socket } = useAuthStore();
  const [isDown, setIsDown] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;

    const down = () => setIsDown(true);
    const up = () => setIsDown(false);

    socket.on("disconnect", down);
    socket.on("connect_error", down);
    socket.on("connect", up);

    setIsDown(!socket.connected);

    return () => {
      socket.off("disconnect", down);
      socket.off("connect_error", down);
      socket.off("connect", up);
    };
  }, [socket]);

  if (!isDown) return null;

  return (
    <div
      role="status"
      className="fixed top-16 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
    >
      <div className="alert alert-warning py-2 px-4 w-auto shadow-lg flex items-center gap-2">
        <WifiOff className="size-4" />
        <span className="text-sm">Reconnecting — new messages may be delayed</span>
      </div>
    </div>
  );
};

export default ConnectionBanner;
