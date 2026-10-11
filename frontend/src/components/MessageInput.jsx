import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage, isSending, notifyTyping, stopTyping, selected } = useChatStore();

  // Leaving a chat mid-sentence should not leave the other side with a
  // typing indicator stuck on screen.
  useEffect(() => stopTyping, [selected?._id, stopTyping]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image");
      event.target.value = "";
      return;
    }

    // Checked here as well as on the server, so the user finds out before
    // waiting for a 5 MB upload to be rejected.
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is larger than 5 MB");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChange = (event) => {
    setText(event.target.value);
    if (event.target.value) notifyTyping();
    else stopTyping();
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (isSending) return;

    const trimmed = text.trim();
    if (!trimmed && !imagePreview) return;

    const sent = await sendMessage({ text: trimmed, image: imagePreview });
    if (!sent) return; // the toast already explained why; keep the draft

    setText("");
    removeImage();
  };

  return (
    <div className="p-3 sm:p-4 w-full border-t border-base-300">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2 animate-slide-down">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Attachment preview"
              className="w-20 h-20 object-cover rounded-lg border border-base-300"
            />
            <button
              onClick={removeImage}
              type="button"
              aria-label="Remove attachment"
              className="press absolute -top-1.5 -right-1.5 size-5 rounded-full bg-base-300 flex items-center justify-center hover:bg-error hover:text-error-content"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 input input-bordered rounded-lg input-sm sm:input-md transition-all duration-200 focus:ring-2 focus:ring-primary/30"
          placeholder={`Message ${selected?.name ?? ""}`}
          value={text}
          onChange={handleChange}
          onBlur={stopTyping}
          maxLength={4000}
          aria-label="Message text"
        />

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageChange}
        />

        <button
          type="button"
          aria-label="Attach an image"
          className={`press btn btn-circle btn-sm sm:btn-md ${imagePreview ? "text-primary" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="size-5" />
        </button>

        <button
          type="submit"
          aria-label="Send message"
          className="press group btn btn-primary btn-circle btn-sm sm:btn-md disabled:opacity-40"
          disabled={isSending || (!text.trim() && !imagePreview)}
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5 transition-transform duration-200 group-hover:translate-x-0.5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
