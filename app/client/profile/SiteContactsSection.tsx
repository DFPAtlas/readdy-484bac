"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ClientSiteContact as ClientContact, ClientSiteContactError, loadClientSiteContacts, saveClientSiteContact, deleteClientSiteContact } from "@/lib/client-site-contacts";

interface Props {
  clientId: string;
  onMessage: (type: "success" | "error", text: string) => void;
}

const CONTACT_TYPES = [
  { value: "primary", label: "Primary Contact", icon: "ri-user-star-line" },
  { value: "site_manager", label: "Site Manager", icon: "ri-building-4-line" },
  { value: "emergency", label: "Emergency Contact", icon: "ri-alarm-warning-line" },
  { value: "finance", label: "Finance Contact", icon: "ri-money-pound-circle-line" },
  { value: "billing", label: "Billing Contact", icon: "ri-receipt-line" },
];

export default function SiteContactsSection({ clientId, onMessage }: Props) {
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

  const resetForm = useCallback(() => {
    setForm({ contact_type: "primary", name: "", role: "", email: "", phone: "", is_default: false });
    setEditing(null);
  }, []);

  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState('');
  const mounted = useRef(false);
  const lifetime = useRef(0);
  const reads = useRef(0);
  const operation = useRef(0);
  const busy = useRef(false);
  const draftId = useRef<string | null>(null);
  const ownerScope = useRef(clientId);
  const authenticatedUser = useRef<string | null>(null);
  ownerScope.current = clientId;
  const retire = useCallback(() => { lifetime.current++; reads.current++; operation.current++; busy.current = false; }, []);
  const refresh = useCallback(async () => {
    if (!mounted.current || busy.current) return;
    const id = ++reads.current, epoch = lifetime.current;
    const current = () => mounted.current && reads.current === id && lifetime.current === epoch && ownerScope.current === clientId;
    setLoading(true); setLoadError(false); setLoadedFor(clientId); setContacts([]);
    try {
      const rows = await loadClientSiteContacts(supabase, clientId, current, userId => { if (current()) authenticatedUser.current = userId; });
      if (current()) setContacts(rows);
    } catch { if (current()) setLoadError(true); }
    finally { if (current()) setLoading(false); }
  }, [clientId]);
  useEffect(() => {
    mounted.current = true;
    resetForm(); setShowForm(false); setFormError(''); setSaving(false); draftId.current = null;
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userId !== authenticatedUser.current)) {
        authenticatedUser.current = userId;
        retire(); resetForm(); setShowForm(false); setContacts([]); setFormError(''); setSaving(false); setLoading(true); draftId.current = null;
        clearTimeout(timer);
        timer = setTimeout(() => { if (mounted.current) void refresh(); }, 0);
      }
    });
    return () => { mounted.current = false; retire(); subscription.unsubscribe(); clearTimeout(timer); };
  }, [refresh, retire, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current || loading || loadError || loadedFor !== clientId || !showForm) return;
    const id = editing?.id || draftId.current;
    if (!id) { setFormError('Reopen the contact form and retry.'); return; }
    busy.current = true;
    const token = ++operation.current, epoch = lifetime.current;
    const current = () => mounted.current && lifetime.current === epoch && operation.current === token && ownerScope.current === clientId;
    setSaving(true); setFormError('');
    try {
      const saved = await saveClientSiteContact(supabase, clientId, id, form, !!editing, current);
      if (!current()) return;
      setContacts(previous => previous.some(c => c.id === saved.id) ? previous.map(c => c.id === saved.id ? saved : c) : [...previous, saved]);
      resetForm(); draftId.current = null; setShowForm(false);
      onMessage('success', editing ? 'Contact updated successfully.' : 'Contact added successfully.');
    } catch (error) {
      if (current()) { const message = error instanceof ClientSiteContactError ? error.message : 'The save could not be confirmed. Your draft is kept; retry.'; setFormError(message); onMessage('error', message); }
    } finally {
      if (operation.current === token) { busy.current = false; if (mounted.current && ownerScope.current === clientId) setSaving(false); }
    }
  };
  const handleEdit = (contact: ClientContact) => {
    if (busy.current || loading || loadError || contact.client_id !== clientId) return;
    setEditing(contact); draftId.current = null; setFormError('');
    setForm({ contact_type: contact.contact_type, name: contact.name, role: contact.role || '', email: contact.email || '', phone: contact.phone || '', is_default: contact.is_default === true });
    setShowForm(true);
  };
  const handleDelete = async (id: string) => {
    if (busy.current || loading || loadError || !contacts.some(c => c.id === id && c.client_id === clientId)) return;
    if (!confirm('Are you sure you want to delete this contact?')) return;
    busy.current = true;
    const token = ++operation.current, epoch = lifetime.current;
    const current = () => mounted.current && lifetime.current === epoch && operation.current === token && ownerScope.current === clientId;
    setSaving(true); setFormError('');
    try {
      await deleteClientSiteContact(supabase, clientId, id, current);
      if (!current()) return;
      setContacts(previous => previous.filter(c => c.id !== id));
      if (editing?.id === id || draftId.current === id) { resetForm(); draftId.current = null; setShowForm(false); }
      onMessage('success', 'Contact deleted.');
    } catch (error) { if (current()) { const message = error instanceof ClientSiteContactError ? error.message : 'Deletion could not be confirmed. Refresh and retry.'; setFormError(message); onMessage('error', message); } }
    finally { if (operation.current === token) { busy.current = false; if (mounted.current && ownerScope.current === clientId) setSaving(false); } }
  };

  const grouped = CONTACT_TYPES.map((type) => ({
    ...type,
    items: contacts.filter((c) => c.contact_type === type.value),
  }));

  const unavailable = loading || loadError || loadedFor !== clientId;
  if (loadedFor !== clientId) return <div role="status">Loading contacts…</div>;
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
              if (busy.current || unavailable) return;
              resetForm(); draftId.current = crypto.randomUUID(); setFormError('');
              setShowForm(true);
            }}
            disabled={unavailable || saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
            Add Contact
          </button>
        </div>

        <button type="button" onClick={() => void refresh()} disabled={saving || loading} className="mb-4 text-teal-500 underline disabled:opacity-50">Refresh contacts</button>
        {loading && <p role="status">Loading contacts…</p>}
        {loadError && <div role="alert" className="mb-4 text-red-500">Contacts could not be loaded. Please retry.<button type="button" onClick={() => void refresh()} className="ml-3 underline">Retry</button></div>}
        {formError && <p role="alert" className="mb-4 text-red-500">{formError}</p>}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              {editing ? "Edit Contact" : "New Contact"}
            </h3>
            <fieldset disabled={saving || unavailable}><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="site-contact-type" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Contact Type</label>
                <select
                  id="site-contact-type"
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
                <label htmlFor="site-contact-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  id="site-contact-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label htmlFor="site-contact-role" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
                <input
                  type="text"
                  id="site-contact-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="e.g. Operations Manager"
                />
              </div>
              <div>
                <label htmlFor="site-contact-email" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  id="site-contact-email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="contact@company.com"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="site-contact-phone" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                <input
                  type="tel"
                  id="site-contact-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm bg-white dark:bg-[#111d35] text-slate-900 dark:text-white"
                  placeholder="+44 7XXX XXXXXX"
                />
              </div>
            </div>
            </fieldset><div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || unavailable}
                className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {saving ? "Saving..." : editing ? "Update Contact" : "Add Contact"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (busy.current) return;
                  setShowForm(false); setFormError(''); draftId.current = null;
                  resetForm();
                }}
                disabled={saving}
                className="px-4 py-2 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!unavailable && <div className="space-y-4">
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
                          disabled={saving || unavailable}
                          title="Edit"
                        >
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          disabled={saving || unavailable}
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
        </div>}
      </div>
    </div>
  );
}
