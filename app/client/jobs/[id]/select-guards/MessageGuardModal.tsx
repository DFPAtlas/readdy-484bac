"use client";

import { useState } from "react";

interface Props {
  guardName: string;
  guardId: string;
  guardUserId: string;
  jobId?: string;
  onClose: () => void;
  onSend: (message: string, guardUserId: string, jobId?: string) => void;
  sending: boolean;
}

export default function MessageGuardModal({
  guardName,
  guardUserId,
  jobId,
  onClose,
  onSend,
  sending,
}: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
    if (!message.trim()) {
      setError("Please enter a message.");
      return;
    }
    if (message.length > 500) {
      setError("Message must be under 500 characters.");
      return;
    }
    setError("");
    onSend(message.trim(), guardUserId, jobId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1e2d4d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#1e2d4d] flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            <i className="ri-message-3-line mr-2 text-teal-400"></i>
            Message {guardName}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="p-5">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError("");
            }}
            placeholder="Type your message to the guard..."
            maxLength={500}
            rows={5}
            className="w-full bg-[#162036] border border-[#1e2d4d] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {message.length}/500
            </span>
            {error && (
              <span className="text-xs text-red-400">{error}</span>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-[#162036] text-slate-300 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl hover:bg-teal-600 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </span>
              ) : (
                <>
                  <i className="ri-send-plane-line mr-1.5"></i>
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}