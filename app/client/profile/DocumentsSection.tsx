"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface ClientDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  description: string;
  expiry_date: string;
  created_at: string;
}

interface Props {
  clientId: string;
  documents: ClientDocument[];
  onRefresh: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const DOC_TYPES = [
  { value: "insurance", label: "Insurance Document", icon: "ri-shield-check-line", color: "text-emerald-500" },
  { value: "purchase_order", label: "Purchase Order", icon: "ri-file-list-3-line", color: "text-blue-500" },
  { value: "site_instructions", label: "Site Instructions", icon: "ri-map-pin-line", color: "text-amber-500" },
  { value: "authorisation_letter", label: "Authorisation Letter", icon: "ri-file-shield-line", color: "text-violet-500" },
  { value: "contract", label: "Contract", icon: "ri-file-paper-line", color: "text-teal-500" },
  { value: "other", label: "Other", icon: "ri-file-3-line", color: "text-slate-500" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DocumentsSection({ clientId, documents, onRefresh, onMessage }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    document_type: "insurance",
    file_name: "",
    file_url: "",
    description: "",
    expiry_date: "",
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onMessage("error", "File must be under 10MB");
      return;
    }

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `client-documents/${clientId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("client-files")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      setUploading(false);
      if (uploadError.message?.includes("bucket") || uploadError.message?.includes("not found")) {
        onMessage("error", "File storage is not configured. Please contact support to upload documents.");
      } else {
        onMessage("error", "Upload failed. " + uploadError.message);
      }
      return;
    }

    const { data: urlData } = supabase.storage.from("client-files").getPublicUrl(filePath);

    setForm((f) => ({
      ...f,
      file_name: file.name,
      file_url: urlData.publicUrl,
    }));
    setUploading(false);
    onMessage("success", "File uploaded. Fill in the details and save.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file_url) {
      onMessage("error", "Please upload a file first.");
      return;
    }

    const { error } = await supabase.from("client_documents").insert({
      client_id: clientId,
      document_type: form.document_type,
      file_name: form.file_name,
      file_url: form.file_url,
      file_size: 0,
      description: form.description,
      expiry_date: form.expiry_date || null,
    });

    if (error) {
      onMessage("error", "Failed to save document.");
      return;
    }

    setForm({ document_type: "insurance", file_name: "", file_url: "", description: "", expiry_date: "" });
    setShowForm(false);
    onMessage("success", "Document saved successfully.");
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("client_documents").delete().eq("id", id);
    if (error) {
      onMessage("error", "Failed to delete document.");
      return;
    }
    onMessage("success", "Document deleted.");
    onRefresh();
  };

  return (
    <div>
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Documents</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Upload and manage your company documents
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-upload-cloud-line w-4 h-4 flex items-center justify-center"></i>
            Upload
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Upload Document</h3>

            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">File</label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="w-full text-sm text-slate-700 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600"
                />
              </div>
              {uploading && (
                <p className="text-xs text-teal-500 mt-1 flex items-center gap-1">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Uploading...
                </p>
              )}
              {form.file_name && (
                <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                  <i className="ri-checkbox-circle-line"></i>
                  {form.file_name}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">Max 10MB. PDF, Word, or images.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Document Type</label>
                <select
                  value={form.document_type}
                  onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white pr-8"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                placeholder="e.g. Public Liability Insurance 2025"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={uploading || !form.file_url}
                className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Save Document
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm({ document_type: "insurance", file_name: "", file_url: "", description: "", expiry_date: "" });
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-folder-3-line text-2xl text-slate-400 dark:text-slate-600"></i>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No documents uploaded</p>
            <p className="text-xs text-slate-400 mt-1">Upload insurance, contracts, or site instructions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const typeInfo = DOC_TYPES.find((t) => t.value === doc.document_type) || DOC_TYPES[5];
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 bg-white dark:bg-[#111d35] rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-[#1e2d4d]">
                    <i className={`${typeInfo.icon} ${typeInfo.color} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{doc.file_name}</p>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#1e2d4d] text-slate-600 dark:text-slate-400">
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {doc.description && <span className="truncate">{doc.description}</span>}
                      {doc.expiry_date && (
                        <span className={`${new Date(doc.expiry_date) < new Date() ? "text-red-500" : ""}`}>
                          Expires: {new Date(doc.expiry_date).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-teal-500 hover:bg-teal-500/10 transition-colors cursor-pointer"
                      title="Open"
                    >
                      <i className="ri-external-link-line text-sm"></i>
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}