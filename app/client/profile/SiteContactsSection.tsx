"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface ClientContact {
  id: string;
  contact_type: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_default: boolean;
}

interface Props {
  clientId: string;
  contacts: ClientContact[];
  onRefresh: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const CONTACT_TYPES = [
  { value: "primary", label: "Primary Contact", icon: "ri-user-star-line" },
  { value: "site_manager", label: "Site Manager", icon: "ri-building-4-line" },
  { value: "emergency", label: "Emergency Contact", icon: "ri-alarm-warning-line" },
  { value: "finance", label: "Finance Contact", icon: "ri-money-pound-circle-line" },
  { value: "billing", label: "Billing Contact", icon: "ri-receipt-line" },
];

export default function SiteContactsSection({ clientId, contacts, onRefresh, onMessage }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClientContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_type: "primary",
    name: "",
    role: "",
    email: "",
    phone: "",
    is_default: false,
  });

  const resetForm = () => {
    setForm({ contact_type: "primary", name: "", role: "", email: "", phone: "", is_default: false });
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("client_contacts")
        .update({
          contact_type: form.contact_type,
          name: form.name,
          role: form.role,
          email: form.email,
          phone: form.phone,
          is_default: form.is_default,
        })
        .eq("id", editing.id);

      setSaving(false);
      if (error) {
        onMessage("error", "Failed to update contact.");
        return;
      }
      onMessage("success", "Contact updated successfully.");
    } else {
      const { error } = await supabase.from("client_contacts").insert({
        client_id: clientId,
        contact_type: form.contact_type,
        name: form.name,
        role: form.role,
        email: form.email,
        phone: form.phone,
        is_default: form.is_default,
      });

      setSaving(false);
      if (error) {
        onMessage("error", "Failed to add contact.");
        return;
      }
      onMessage("success", "Contact added successfully.");
    }

    resetForm();
    setShowForm(false);
    onRefresh();
  };

  const handleEdit = (contact: ClientContact) => {
    setEditing(contact);
    setForm({
      contact_type: contact.contact_type,
      name: contact.name,
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
      is_default: contact.is_default || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    const { error } = await supabase.from("client_contacts").delete().eq("id", id);
    if (error) {
      onMessage("error", "Failed to delete contact.");
      return;
    }
    onMessage("success", "Contact deleted.");
    onRefresh();
  };

  const grouped = CONTACT_TYPES.map((type) => ({
    ...type,
    items: contacts.filter((c) => c.contact_type === type.value),
  }));

  return (
    <div>
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Site Contacts</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage contacts for different roles at your company
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
            Add Contact
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              {editing ? "Edit Contact" : "New Contact"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Contact Type</label>
                <select
                  value={form.contact_type}
                  onChange={(e) => setForm((f) => ({ ...f, contact_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white pr-8"
                >
                  {CONTACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="e.g. Operations Manager"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="contact@company.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="+44 7XXX XXXXXX"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {saving ? "Saving..." : editing ? "Update Contact" : "Add Contact"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-2">
                <i className={`${group.icon} text-teal-500`}></i>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.label}</h3>
                <span className="text-xs text-slate-400">({group.items.length})</span>
              </div>
              {group.items.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 pl-6">No contacts added yet</p>
              ) : (
                <div className="space-y-2">
                  {group.items.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {contact.name}
                          </p>
                          {contact.is_default && (
                            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/20">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {contact.role && <span>{contact.role}</span>}
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <i className="ri-mail-line text-[10px]"></i>
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <i className="ri-phone-line text-[10px]"></i>
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-teal-500 hover:bg-teal-500/10 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}