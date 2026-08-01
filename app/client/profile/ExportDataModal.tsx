"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  clientId: string;
  userId: string;
  companyName: string;
  onClose: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const EXPORTABLES = [
  { key: "profile", label: "Company Profile", icon: "ri-building-line" },
  { key: "jobs", label: "Job History", icon: "ri-briefcase-4-line" },
  { key: "guards", label: "Selected Guards", icon: "ri-user-star-line" },
  { key: "payments", label: "Payments & Invoices", icon: "ri-bill-line" },
  { key: "tickets", label: "Support Tickets", icon: "ri-customer-service-2-line" },
  { key: "messages", label: "Messages", icon: "ri-message-3-line" },
  { key: "sites", label: "Saved Sites", icon: "ri-map-pin-line" },
  { key: "documents", label: "Documents List", icon: "ri-folder-3-line" },
];

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportDataModal({ clientId, userId, companyName, onClose, onMessage }: Props) {
  const [selected, setSelected] = useState<string[]>(["profile"]);
  const [format, setFormat] = useState<"csv" | "json" | "print">("csv");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectAll = () => {
    if (selected.length === EXPORTABLES.length) {
      setSelected([]);
    } else {
      setSelected(EXPORTABLES.map((e) => e.key));
    }
  };

  const loadData = useCallback(async () => {
    const result: Record<string, any[]> = {};

    if (selected.includes("profile")) {
      const { data } = await supabase
        .from("clients")
        .select("company_name, first_name, last_name, email, phone, industry, company_size, address_line1, city, postcode, website, vat_number, billing_email, company_registration_number, subscription_tier, subscription_status, created_at")
        .eq("id", clientId)
        .maybeSingle();
      if (data) result.profile = [{ ...data, export_date: new Date().toISOString() }];
    }

    if (selected.includes("jobs")) {
      const { data } = await supabase
        .from("jobs")
        .select("id, job_title, venue_name, venue_city, venue_postcode, start_date, end_date, start_time, end_time, status, number_of_guards, hourly_rate, urgency, assigned_count, applications_count, created_at, updated_at")
        .eq("client_id", clientId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      result.jobs = data || [];
    }

    if (selected.includes("guards")) {
      const { data: assignments } = await supabase
        .from("job_assignments")
        .select("id, job_id, guard_id, status, assigned_at, completed_at, payment_status, payment_amount, guards(id, full_name, sia_licence_number, sia_expiry_date, sia_verified, licence_types, rating, phone, email)")
        .in("job_id", (await supabase.from("jobs").select("id").eq("client_id", clientId)).data?.map((j) => j.id) || []);
      result.guards = (assignments || []).map((a: any) => ({
        assignment_id: a.id,
        job_id: a.job_id,
        guard_id: a.guard_id,
        guard_name: a.guards?.full_name || "",
        sia_licence_number: a.guards?.sia_licence_number || "",
        sia_verified: a.guards?.sia_verified || false,
        sia_expiry_date: a.guards?.sia_expiry_date || "",
        licence_types: a.guards?.licence_types || "",
        rating: a.guards?.rating || 0,
        status: a.status,
        assigned_at: a.assigned_at,
        completed_at: a.completed_at,
        payment_status: a.payment_status,
        payment_amount: a.payment_amount,
      }));
    }

    if (selected.includes("payments")) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, transaction_type, status, amount, currency, created_at, completed_at, payment_status, receipt_url, invoice_url, refunded, refund_amount, job_id, assignment_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      const { data: subs } = await supabase
        .from("subscription_payments")
        .select("id, amount, status, created_at, stripe_invoice_id, stripe_subscription_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      result.payments = [
        ...(txs || []).map((t) => ({ ...t, type: "job" })),
        ...(subs || []).map((s) => ({ ...s, type: "subscription" })),
      ];
    }

    if (selected.includes("tickets")) {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, ticket_reference, category, subject, description, priority, status, created_at, updated_at, resolved_at, resolution_notes, admin_notes, related_job_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      result.tickets = data || [];
    }

    if (selected.includes("messages")) {
      const { data } = await supabase
        .from("messages")
        .select("id, job_id, sender_id, sender_type, receiver_id, receiver_type, message_text, read, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      result.messages = (data || []).map((m: any) => ({
        id: m.id,
        job_id: m.job_id,
        sender_type: m.sender_type,
        receiver_type: m.receiver_type,
        message_text: m.message_text,
        read: m.read,
        created_at: m.created_at,
      }));
    }

    if (selected.includes("sites")) {
      const { data } = await supabase
        .from("saved_sites")
        .select("id, site_name, address_line1, city, postcode, site_type, site_contact_name, site_contact_phone, site_contact_email, status, archived, created_at, updated_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      result.sites = data || [];
    }

    if (selected.includes("documents")) {
      const { data } = await supabase
        .from("client_documents")
        .select("id, document_type, file_name, file_url, file_size, description, expiry_date, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      result.documents = data || [];
    }

    return result;
  }, [clientId, userId, selected]);

  const handleExport = async () => {
    if (selected.length === 0) {
      onMessage("error", "Please select at least one data category.");
      return;
    }
    setLoading(true);
    try {
      const data = await loadData();

      if (format === "json") {
        const payload = {
          export_metadata: {
            exported_by: companyName,
            exported_at: new Date().toISOString(),
            user_id: userId,
            client_id: clientId,
          },
          ...data,
        };
        const content = JSON.stringify(payload, null, 2);
        downloadBlob(`quickguard-data-export-${clientId.slice(0, 8)}.json`, content, "application/json");
        onMessage("success", "JSON export downloaded successfully.");
      } else if (format === "csv") {
        let csv = "QuickGuard Data Export\n";
        csv += `Exported by: ${companyName}\n`;
        csv += `Date: ${new Date().toLocaleDateString("en-GB")}\n\n`;
        Object.entries(data).forEach(([key, rows]) => {
          if (rows.length > 0) {
            csv += `--- ${key.toUpperCase()} ---\n`;
            csv += toCSV(rows);
            csv += "\n\n";
          }
        });
        downloadBlob(`quickguard-data-export-${clientId.slice(0, 8)}.csv`, csv, "text/csv");
        onMessage("success", "CSV export downloaded successfully.");
      } else if (format === "print") {
        const payload = {
          export_metadata: {
            exported_by: companyName,
            exported_at: new Date().toISOString(),
            user_id: userId,
            client_id: clientId,
          },
          ...data,
        };
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write("<html><head><title>QuickGuard Data Export</title></head><body><pre>");
          printWindow.document.write(JSON.stringify(payload, null, 2));
          printWindow.document.write("</pre></body></html>");
          printWindow.document.close();
          printWindow.print();
        }
        onMessage("success", "Print view opened.");
      }

      onClose();
    } catch (e: any) {
      onMessage("error", "Export failed. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (key: string) => {
    setPreviewKey(key);
    setPreview("Loading...");
    try {
      const data = await loadData();
      const rows = data[key] || [];
      if (rows.length === 0) {
        setPreview("No records found.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const lines = [
        headers.join(","),
        ...rows.slice(0, 5).map((row: any) => headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")),
      ];
      if (rows.length > 5) lines.push(`... and ${rows.length - 5} more rows`);
      setPreview(lines.join("\n"));
    } catch (e) {
      setPreview("Failed to load preview.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#111d35] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-[#1e2d4d]">
        <div className="sticky top-0 bg-white dark:bg-[#111d35] border-b border-slate-200 dark:border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export My Data</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Select categories and format</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Select All */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Select Data Categories</p>
            <button
              onClick={selectAll}
              className="text-xs font-semibold text-teal-500 hover:text-teal-600 cursor-pointer"
            >
              {selected.length === EXPORTABLES.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXPORTABLES.map((item) => {
              const isSelected = selected.includes(item.key);
              return (
                <div key={item.key} className="relative">
                  <button
                    onClick={() => toggle(item.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      isSelected
                        ? "border-teal-500 bg-teal-500/5"
                        : "border-slate-200 dark:border-[#1e2d4d] hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "bg-teal-500 border-teal-500" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {isSelected && <i className="ri-check-line text-white text-xs"></i>}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <i className={`${item.icon} text-slate-500 dark:text-slate-400`}></i>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePreview(item.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-teal-500 cursor-pointer px-2 py-1"
                  >
                    Preview
                  </button>
                </div>
              );
            })}
          </div>

          {/* Format */}
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Export Format</p>
            <div className="flex gap-2">
              {[
                { key: "csv", label: "CSV", icon: "ri-file-list-3-line" },
                { key: "json", label: "JSON", icon: "ri-braces-line" },
                { key: "print", label: "Print View", icon: "ri-printer-line" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    format === f.key
                      ? "border-teal-500 bg-teal-500/10 text-teal-500"
                      : "border-slate-200 dark:border-[#1e2d4d] text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <i className={f.icon}></i>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview panel */}
          {preview && previewKey && (
            <div className="bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-3 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Preview: {EXPORTABLES.find(e => e.key === previewKey)?.label}</p>
                <button onClick={() => { setPreview(null); setPreviewKey(null); }} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                  <i className="ri-close-line"></i>
                </button>
              </div>
              <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{preview}</pre>
            </div>
          )}

          {/* PDF placeholder */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-2">
            <i className="ri-file-pdf-line text-blue-500 text-lg flex-shrink-0 mt-0.5"></i>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">PDF Export</p>
              <p className="text-xs text-slate-500">
                PDF export is coming soon. Use CSV or JSON for now, or use the Print View and save as PDF.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleExport}
              disabled={loading || selected.length === 0}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Exporting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-download-cloud-line"></i>
                  Export {selected.length} category{selected.length !== 1 ? "ies" : "y"}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}