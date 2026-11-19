"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_EXPORT_CATEGORIES, ClientExportCategory, loadClientDataExport, buildClientExport, clientExportCSV, clientExportPreview } from "@/lib/client-data-export";

interface Props {
  clientId: string;
  userId: string;
  companyName: string;
  onClose: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

export function downloadClientExport(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportDataModal({ clientId, userId, companyName, onClose, onMessage }: Props) {
  const [selected, setSelected] = useState<ClientExportCategory[]>(["profile"]);
  const [format, setFormat] = useState<"csv" | "json" | "print">("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: ClientExportCategory; text: string; loading: boolean; error: boolean } | null>(null);
  const request = useRef(0);
  const mounted = useRef(false);
  const pendingPrint = useRef<Window | null>(null);
  const invalidate = useCallback(() => {
    request.current++;
    pendingPrint.current?.close();
    pendingPrint.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    setPreview(null);
    return () => { mounted.current = false; invalidate(); };
  }, [clientId, userId, invalidate]);
  const close = () => { invalidate(); onClose(); };
  const current = (id: number) => mounted.current && request.current === id;

  const handlePreview = async (key: ClientExportCategory) => {
    if (loading) return;
    const id = ++request.current;
    setPreview({ key, text: "Loading preview…", loading: true, error: false });
    try {
      // Preview explicitly requests its category, independently of selection.
      const data = await loadClientDataExport(supabase, clientId, userId, [key]);
      if (current(id)) setPreview({ key, text: clientExportPreview(key, data[key]!), loading: false, error: false });
    } catch {
      if (current(id)) setPreview({ key, text: "Preview could not be loaded. Please retry.", loading: false, error: true });
    }
  };

  const handleExport = async () => {
    if (loading || !selected.length) return;
    const id = ++request.current;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      let printWindow: Window | null = null;
      if (format === "print") {
        printWindow = window.open("", "_blank");
        if (!printWindow) throw new Error("Print view blocked");
        pendingPrint.current = printWindow;
        printWindow.document.title = "QuickGuard Data Export";
      }
      const data = await loadClientDataExport(supabase, clientId, userId, [...selected]);
      if (!current(id)) return;
      const payload = buildClientExport(data, clientId, userId, companyName);
      const content = JSON.stringify(payload, null, 2);
      if (format === "print" && printWindow) {
        // Customer-controlled text must never be interpreted as HTML.
        const pre = printWindow.document.createElement("pre");
        pre.textContent = content;
        printWindow.document.body.replaceChildren(pre);
        printWindow.print();
        pendingPrint.current = null;
        onMessage("success", "Print view opened.");
      } else {
        const extension = format === "json" ? "json" : "csv";
        downloadClientExport(
          "quickguard-data-export-" + clientId.slice(0, 8) + "." + extension,
          format === "json" ? content : clientExportCSV(data),
          format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
        );
        onMessage("success", extension.toUpperCase() + " download started.");
      }
      onClose();
    } catch {
      if (current(id)) {
        pendingPrint.current?.close();
        pendingPrint.current = null;
        setError(format === 'print' ? "Print view could not be opened. Allow pop-ups for QuickGuard and retry, or choose CSV or JSON." : "Export could not be completed. Please retry.");
        onMessage("error", "Export could not be completed. Please retry.");
      }
    } finally {
      if (current(id)) setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="client-export-title" className="bg-white dark:bg-[#111d35] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-[#1e2d4d]">
        <div className="sticky top-0 bg-white dark:bg-[#111d35] border-b border-slate-200 dark:border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 id="client-export-title" className="text-lg font-bold text-slate-900 dark:text-white">Export My Data</h3>
            <p className="text-sm text-slate-500 mt-0.5">Select categories and format. Preview any category without selecting it.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close data export" className="p-2 text-slate-500">Close</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>Jobs and assigned-guard history exclude deleted jobs. Payment records retain your ledger history, including cancelled or deleted jobs. Deleted tickets and sites are excluded; archived sites remain.</p>
            <p>Documents include file metadata only. Private guard contact details, internal notes and provider or file-access links are excluded. Unavailable or unrecorded values are null, rather than an assumed false or zero.</p>
            <p>Company Profile includes site contacts. CSV uses one table and marks empty categories; JSON includes counts. Preview shows up to five records and does not change your selection.</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Select Data Categories</p>
            <button type="button" disabled={loading} onClick={() => setSelected(selected.length === CLIENT_EXPORT_CATEGORIES.length ? [] : CLIENT_EXPORT_CATEGORIES.map(c => c.key))} className="text-xs font-semibold text-teal-500 disabled:opacity-50">
              {selected.length === CLIENT_EXPORT_CATEGORIES.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLIENT_EXPORT_CATEGORIES.map(item => (
              <div key={item.key} className="flex items-center gap-1">
                <button type="button" disabled={loading} aria-pressed={selected.includes(item.key)} aria-label={"Select " + item.label}
                  onClick={() => setSelected(previous => previous.includes(item.key) ? previous.filter(key => key !== item.key) : [...previous, item.key])}
                  className={"flex-1 text-left p-3 rounded-xl border-2 text-sm text-slate-900 dark:text-white disabled:opacity-50 " + (selected.includes(item.key) ? "border-teal-500 bg-teal-500/5" : "border-slate-200 dark:border-[#1e2d4d]")}>
                  {item.label}
                </button>
                <button type="button" disabled={loading} aria-label={"Preview " + item.label} onClick={() => handlePreview(item.key)} className="text-xs text-teal-600 dark:text-teal-400 px-2 py-2 disabled:opacity-50">Preview</button>
              </div>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Export Format</p>
            <div className="flex gap-2">
              {(["csv", "json", "print"] as const).map(value => (
                <button key={value} type="button" disabled={loading} aria-pressed={format === value} onClick={() => setFormat(value)}
                  className={"flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold disabled:opacity-50 " + (format === value ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-slate-200 dark:border-[#1e2d4d] text-slate-500")}>
                  {value === "print" ? "Print View" : value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {preview && <div aria-live="polite" className="bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-3 overflow-auto">
            <p className="text-xs font-semibold text-slate-500 mb-2">Preview: {CLIENT_EXPORT_CATEGORIES.find(c => c.key === preview.key)?.label}</p>
            <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{preview.text}</pre>
            {preview.error && <button type="button" onClick={() => handlePreview(preview.key)} className="text-teal-600 text-xs underline">Retry preview</button>}
          </div>}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className="text-xs text-slate-500">Provider-issued receipts and invoices are separate from these recorded payments. PDF export is coming soon; use your browser’s Print View to save a PDF.</p>
          <div className="flex gap-3">
            <button type="button" onClick={handleExport} disabled={loading || !selected.length} className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? "Exporting…" : error ? "Retry export" : "Export " + selected.length + " " + (selected.length === 1 ? "category" : "categories")}
            </button>
            <button type="button" onClick={close} className="px-6 py-3 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
