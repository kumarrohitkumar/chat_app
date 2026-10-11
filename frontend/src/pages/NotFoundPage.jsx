import { Link } from "react-router-dom";
import { MessageSquareDashed } from "lucide-react";

const NotFoundPage = () => (
  <div className="h-screen flex items-center justify-center px-4">
    <div className="text-center space-y-4">
      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <MessageSquareDashed className="size-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-base-content/60">That link does not lead anywhere.</p>
      <Link to="/" className="btn btn-primary btn-sm">
        Back to chats
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
