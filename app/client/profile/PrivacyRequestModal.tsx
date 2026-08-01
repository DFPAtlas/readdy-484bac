"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  clientId: string;
  userId: string;
  requestType: string;
  onClose: () => void;
  onSuccess: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: "Access my data",
  correct: "Correct my data",
  delete: "Delete my account data",
  restrict: "Restrict processing",
  portability: "Data portability",
  contact_support: "Contact privacy support",
};

const REQUEST_TYPE_DESCRIPTIONS: Record<string, string> = {
  access: "Request a full copy of all data QuickGuard holds about you and your company.",
  correct: "Tell us what information is incorrect and how it should be corrected.",
  delete: "Request deletion of your account and associated data. Note: some records may be retained for legal reasons.",
  restrict: "Request that we limit how we use your data while we review or correct it.",
  portability: "Request your data in a structured, machine-readable format to transfer to another service.",
  contact_support: "Reach out to our privacy team for general questions or concerns.",
};

export default function PrivacyRequestModal({ clientId, userId, requestType, onClose, onSuccess, onMessage }: Props) {
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createTicket, setCreateTicket] = useState(true);

  const handleSubmit = async () => {
    setError("");
    if (!description.trim()) {
      setError("Please provide a description of your request.");
      return;
    }

    setSubmitting(true);
    try {
      let supportTicketId: string | null = null;

      if (createTicket) {
        const { data: ticket, error: ticketError } = await supabase
          .from("support_tickets")
          .insert({
            client_id: clientId,
            category: "account_billing",
            subject: `Privacy Request: ${REQUEST_TYPE_LABELS[requestType] || requestType}`,
            description: description.trim(),
            priority: requestType === "delete" ? "high" : "normal",
            status: "open",
            contact_preference: "email",
          })
          .select("id")
          .single();

        if (!ticketError && ticket) {
          supportTicketId = ticket.id;
        }
      }

      const { error: insertError } = await supabase
        .from("privacy_requests")
        .insert({
          client_id: clientId,
          user_id: userId,
          request_type: requestType,
          description: description.trim(),
          status: "submitted",
          support_ticket_id: supportTicketId,
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit request. Please try again.");
      onMessage("error", "Failed to submit privacy request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#111d35] rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-[#1e2d4d]">
        <div className="sticky top-0 bg-white dark:bg-[#111d35] border-b border-slate-200 dark:border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Privacy Request</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {REQUEST_TYPE_LABELS[requestType] || requestType}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-2">
            <i className="ri-information-line text-blue-500 text-lg flex-shrink-0 mt-0.5"></i>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {REQUEST_TYPE_DESCRIPTIONS[requestType] || ""}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Details of your request <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white"
              placeholder="Describe what you need and why..."
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{description.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white"
              placeholder="your@email.com"
            />
            <p className="text-xs text-slate-500 mt-1">Optional — we'll use your account email if left blank</p>
          </div>

          <div className="flex items-center gap-2">
            <div
              onClick={() => setCreateTicket(!createTicket)}
              className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                createTicket ? "bg-teal-500 border-teal-500" : "border-slate-300 dark:border-slate-600"
              }`}
            >
              {createTicket && <i className="ri-check-line text-white text-xs"></i>}
            </div>
            <span className="text-sm text-slate-300 cursor-pointer" onClick={() => setCreateTicket(!createTicket)}>
              Also create a support ticket for tracking
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-send-plane-line"></i>
                  Submit Request
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-[#1e2d4d] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}