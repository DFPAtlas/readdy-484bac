"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import ExportDataModal from "./ExportDataModal";
import PrivacyRequestModal from "./PrivacyRequestModal";

interface PrivacyRequest {
  id: string;
  request_type: string;
  description: string;
  status: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
  support_ticket_id: string | null;
}

interface ClientProfile {
  id: string;
  user_id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  industry: string;
  company_size: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  website: string;
  description: string;
  vat_number: string;
  billing_email: string;
  company_registration_number: string;
  verified: boolean;
  created_at: string;
  subscription_tier: string;
  subscription_status: string;
  client_promo_tier: string;
  client_promo_jobs_remaining: number;
  founding_client_badge: boolean;
  client_lifetime_fee_discount: number;
  total_jobs_posted: number;
  total_spent: number;
}

interface Props {
  profile: ClientProfile;
  onMessage: (type: "success" | "error", text: string) => void;
}

const REQUEST_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  submitted: { label: "Submitted", color: "text-blue-400", bg: "bg-blue-500/10", icon: "ri-send-plane-fill" },
  under_review: { label: "Under Review", color: "text-amber-400", bg: "bg-amber-500/10", icon: "ri-eye-line" },
  awaiting_info: { label: "Awaiting Info", color: "text-violet-400", bg: "bg-violet-500/10", icon: "ri-question-mark" },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: "ri-checkbox-circle-fill" },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10", icon: "ri-close-circle-fill" },
  cancelled: { label: "Cancelled", color: "text-slate-400", bg: "bg-slate-500/10", icon: "ri-forbid-fill" },
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: "Access my data",
  correct: "Correct my data",
  delete: "Delete my account data",
  restrict: "Restrict processing",
  portability: "Data portability",
  contact_support: "Contact privacy support",
};

export default function DataPrivacySection({ profile, onMessage }: Props) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [selectedRequestType, setSelectedRequestType] = useState<string>("");
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!profile) return;
    setLoadingRequests(true);
    const { data, error } = await supabase
      .from("privacy_requests")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data as PrivacyRequest[]);
    setLoadingRequests(false);
  }, [profile]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRequestClick = (type: string) => {
    if (type === "delete") {
      setSelectedRequestType(type);
      setShowDeleteWarning(true);
    } else {
      setSelectedRequestType(type);
      setShowRequestModal(true);
    }
  };

  const handleCancelRequest = async (id: string) => {
    setCancelingId(id);
    const { error } = await supabase
      .from("privacy_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      onMessage("error", "Failed to cancel request.");
    } else {
      onMessage("success", "Request cancelled.");
      loadRequests();
    }
    setCancelingId(null);
  };

  const handleRequestSuccess = () => {
    setShowRequestModal(false);
    setShowDeleteWarning(false);
    setSelectedRequestType("");
    onMessage("success", "Privacy request submitted successfully.");
    loadRequests();
  };

  return (
    <div>
      {/* Export Data */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Export My Data</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Download your QuickGuard records in CSV or JSON format
            </p>
          </div>
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-download-cloud-line text-teal-500 text-lg"></i>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {[
            { key: "profile", label: "Company Profile", desc: "Company details, contacts, addresses", icon: "ri-building-line" },
            { key: "jobs", label: "Job History", desc: "All jobs posted, dates, status, guards", icon: "ri-briefcase-4-line" },
            { key: "guards", label: "Selected Guards", desc: "Guards assigned to your jobs", icon: "ri-user-star-line" },
            { key: "payments", label: "Payments & Invoices", desc: "Transactions, receipts, subscriptions", icon: "ri-bill-line" },
            { key: "tickets", label: "Support Tickets", desc: "Tickets and resolutions", icon: "ri-customer-service-2-line" },
            { key: "messages", label: "Messages", desc: "Conversation history", icon: "ri-message-3-line" },
            { key: "sites", label: "Saved Sites", desc: "Site details and contacts", icon: "ri-map-pin-line" },
            { key: "documents", label: "Documents", desc: "Uploaded files and descriptions", icon: "ri-folder-3-line" },
          ].map((item) => (
            <div key={item.key} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] flex-shrink-0">
                <i className={`${item.icon} text-teal-500 text-sm`}></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-download-cloud-line w-4 h-4 flex items-center justify-center"></i>
            Export My Data
          </button>
          <Link
            href="/client/reports"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
          >
            <i className="ri-bar-chart-box-line w-4 h-4 flex items-center justify-center"></i>
            View Reports
          </Link>
        </div>
      </div>

      {/* GDPR / Privacy Requests */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Privacy Requests</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Submit a GDPR or data privacy request. Each request is reviewed by QuickGuard support.
            </p>
          </div>
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-user-line text-violet-500 text-lg"></i>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {[
            { key: "access", label: "Access my data", desc: "Receive a full copy of all your data", icon: "ri-database-2-line", color: "text-teal-500" },
            { key: "correct", label: "Correct my data", desc: "Request changes to inaccurate information", icon: "ri-edit-box-line", color: "text-blue-500" },
            { key: "delete", label: "Delete my account", desc: "Request deletion of your account data", icon: "ri-delete-bin-line", color: "text-red-500" },
            { key: "restrict", label: "Restrict processing", desc: "Limit how we use your data", icon: "ri-forbid-line", color: "text-amber-500" },
            { key: "portability", label: "Data portability", desc: "Receive your data in a portable format", icon: "ri-sd-card-line", color: "text-emerald-500" },
            { key: "contact_support", label: "Contact privacy support", desc: "Speak to our privacy team directly", icon: "ri-customer-service-2-line", color: "text-violet-500" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleRequestClick(item.key)}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] hover:border-teal-500/30 hover:shadow-sm transition-all cursor-pointer text-left"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] flex-shrink-0">
                <i className={`${item.icon} ${item.color} text-sm`}></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Request History */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Request History</h3>
          {loadingRequests ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <i className="ri-loader-4-line animate-spin"></i>
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d]">
              <div className="w-10 h-10 bg-white dark:bg-[#111d35] rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-200 dark:border-[#1e2d4d]">
                <i className="ri-shield-check-line text-slate-400 text-lg"></i>
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No privacy requests yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the buttons above to submit your first request</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => {
                const cfg = REQUEST_STATUS_CONFIG[req.status] || REQUEST_STATUS_CONFIG.submitted;
                return (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${cfg.bg} flex-shrink-0`}>
                      <i className={`${cfg.icon} ${cfg.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {req.description ? req.description.slice(0, 80) + (req.description.length > 80 ? "..." : "") : "No additional details"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Submitted {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {req.support_ticket_id && (
                          <span className="ml-2">Linked to support ticket</span>
                        )}
                      </p>
                    </div>
                    {(req.status === "submitted" || req.status === "under_review" || req.status === "awaiting_info") && (
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        disabled={cancelingId === req.id}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-[#1e2d4d]"
                      >
                        {cancelingId === req.id ? "Canceling..." : "Cancel"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-archive-line text-amber-500 text-lg"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Data Retention</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              How long we keep your data and why
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: "Active account data", period: "As long as your account is active", reason: "Required to provide the QuickGuard service" },
            { label: "Job & assignment records", period: "7 years after completion", reason: "Tax, legal, and dispute resolution requirements" },
            { label: "Payment & invoice records", period: "7 years", reason: "HMRC and tax compliance" },
            { label: "Support tickets", period: "3 years after closure", reason: "Customer service and dispute resolution" },
            { label: "Messages", period: "1 year after job completion", reason: "Operational support and dispute evidence" },
            { label: "Deleted account data", period: "Up to 90 days after deletion request", reason: "Safe deletion and backup clearing" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-slate-500">{i + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#1e2d4d] text-slate-600 dark:text-slate-400 w-fit">
                    {item.period}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-2">
          <i className="ri-information-line text-blue-500 text-lg flex-shrink-0 mt-0.5"></i>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Some records may be retained longer than stated if required by law, ongoing disputes, or audit obligations.
            You will be notified before any data is permanently removed.
          </p>
        </div>
      </div>

      {/* Contact Privacy Support */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-mail-send-line text-teal-500 text-lg"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact Privacy Support</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Questions about your data, our privacy policy, or how we handle your information
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/privacy"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
          >
            <i className="ri-file-shield-line w-4 h-4 flex items-center justify-center"></i>
            Privacy Policy
          </Link>
          <Link
            href="/client/support"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
          >
            <i className="ri-customer-service-2-line w-4 h-4 flex items-center justify-center"></i>
            Support Centre
          </Link>
          <button
            onClick={() => handleRequestClick("contact_support")}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-send-plane-line w-4 h-4 flex items-center justify-center"></i>
            Email Privacy Team
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportDataModal
          clientId={profile.id}
          userId={profile.user_id}
          companyName={profile.company_name}
          onClose={() => setShowExportModal(false)}
          onMessage={onMessage}
        />
      )}

      {/* Privacy Request Modal */}
      {showRequestModal && (
        <PrivacyRequestModal
          clientId={profile.id}
          userId={profile.user_id}
          requestType={selectedRequestType}
          onClose={() => {
            setShowRequestModal(false);
            setSelectedRequestType("");
          }}
          onSuccess={handleRequestSuccess}
          onMessage={onMessage}
        />
      )}

      {/* Delete Warning Modal */}
      {showDeleteWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111d35] rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-[#1e2d4d] p-6">
            <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-alert-line text-red-500 text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
              Account Deletion Request
            </h3>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-4">
              Before you proceed, please understand the consequences:
            </p>
            <div className="space-y-3 mb-6">
              {[
                "Deleting your account data may affect your access to job history, invoices, and support records.",
                "Some records (e.g., payments, tax records) may need to be retained for legal, audit, or dispute reasons.",
                "Your request will be reviewed by QuickGuard support before any action is taken.",
                "You may lose access to saved sites, templates, and pending job applications.",
                "Active jobs or pending payments may need to be resolved first.",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <i className="ri-error-warning-line text-amber-500 flex-shrink-0 mt-0.5"></i>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteWarning(false);
                  setShowRequestModal(true);
                }}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                I understand — Proceed
              </button>
              <button
                onClick={() => {
                  setShowDeleteWarning(false);
                  setSelectedRequestType("");
                }}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}