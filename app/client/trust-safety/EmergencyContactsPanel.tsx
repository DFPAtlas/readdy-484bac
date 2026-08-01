'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientContact {
  id: string;
  client_id: string;
  contact_type: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_default: boolean;
}

interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  out_of_hours_contact_name: string | null;
  out_of_hours_contact_phone: string | null;
}

interface EmergencyContactsPanelProps {
  jobs: JobWithSafety[];
  clientId: string;
  onSaveJobContact: (jobId: string, field: string, value: string | null) => void;
}

export default function EmergencyContactsPanel({ jobs, clientId, onSaveJobContact }: EmergencyContactsPanelProps) {
  const [selectedJob, setSelectedJob] = useState<string>(jobs[0]?.id || '');
  const [search, setSearch] = useState('');
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role: '', phone: '', email: '', contact_type: 'site' });
  const [editingJob, setEditingJob] = useState(false);
  const [jobForm, setJobForm] = useState<Record<string, string>>({});

  const filtered = jobs.filter((j) =>
    j.job_title.toLowerCase().includes(search.toLowerCase()) ||
    j.venue_name.toLowerCase().includes(search.toLowerCase())
  );

  const job = jobs.find((j) => j.id === selectedJob) || filtered[0];

  const loadContacts = async () => {
    setLoadingContacts(true);
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setClientContacts((data || []) as ClientContact[]);
    setLoadingContacts(false);
  };

  const addContact = async () => {
    if (!newContact.name.trim()) return;
    const { error } = await supabase.from('client_contacts').insert({
      client_id: clientId,
      name: newContact.name.trim(),
      role: newContact.role.trim() || null,
      phone: newContact.phone.trim() || null,
      email: newContact.email.trim() || null,
      contact_type: newContact.contact_type,
      is_default: false,
    });
    if (!error) {
      setNewContact({ name: '', role: '', phone: '', email: '', contact_type: 'site' });
      setShowAddForm(false);
      loadContacts();
    }
  };

  const startEditingJob = () => {
    if (!job) return;
    setJobForm({
      contact_name: job.contact_name || '',
      contact_phone: job.contact_phone || '',
      contact_email: job.contact_email || '',
      emergency_contact_name: job.emergency_contact_name || '',
      emergency_contact_phone: job.emergency_contact_phone || '',
      out_of_hours_contact_name: job.out_of_hours_contact_name || '',
      out_of_hours_contact_phone: job.out_of_hours_contact_phone || '',
    });
    setEditingJob(true);
  };

  const saveJobContacts = () => {
    if (!job) return;
    Object.entries(jobForm).forEach(([key, value]) => {
      onSaveJobContact(job.id, key, value.trim() || null);
    });
    setEditingJob(false);
  };

  const contactRows = (label: string, name: string | null, phone: string | null, email: string | null) => [
    { label, name, phone, email },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs..."
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-phone-line text-2xl text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No jobs found</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((j) => {
              const hasEmergency = !!(j.emergency_contact_name || j.emergency_contact_phone);
              return (
                <button
                  key={j.id}
                  onClick={() => { setSelectedJob(j.id); setEditingJob(false); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedJob === j.id
                      ? 'bg-teal-500/10 border-teal-500/30'
                      : 'bg-white dark:bg-[#111d35] border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-2">{j.job_title}</p>
                    {hasEmergency ? (
                      <span className="shrink-0 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                        Saved
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
                        Missing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{j.venue_name}</p>
                </button>
              );
            })}
          </div>

          {job && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{job.job_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Emergency & Site Contacts</p>
                  </div>
                  <button
                    onClick={() => editingJob ? saveJobContacts() : startEditingJob()}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {editingJob ? <><i className="ri-save-line mr-1" />Save</> : <><i className="ri-edit-line mr-1" />Edit</>}
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { title: 'Site Contact', icon: 'ri-user-3-line', nameKey: 'contact_name', phoneKey: 'contact_phone', emailKey: 'contact_email', desc: 'The person on site who will greet the guard.' },
                    { title: 'Emergency Contact', icon: 'ri-phone-line', nameKey: 'emergency_contact_name', phoneKey: 'emergency_contact_phone', emailKey: null, desc: 'Who to call in an emergency on site.' },
                    { title: 'Out-of-Hours Contact', icon: 'ri-time-line', nameKey: 'out_of_hours_contact_name', phoneKey: 'out_of_hours_contact_phone', emailKey: null, desc: 'Contact when the site is closed or after hours.' },
                  ].map((section) => (
                    <div key={section.title} className="bg-slate-50 dark:bg-[#162036] rounded-lg border border-slate-200 dark:border-[#1e2d4d] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`${section.icon} text-teal-400 text-sm`} />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{section.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{section.desc}</p>
                      {editingJob ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={jobForm[section.nameKey] || ''}
                            onChange={(e) => setJobForm((prev) => ({ ...prev, [section.nameKey]: e.target.value }))}
                            placeholder="Name"
                            className="px-3 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                          />
                          <input
                            type="text"
                            value={jobForm[section.phoneKey] || ''}
                            onChange={(e) => setJobForm((prev) => ({ ...prev, [section.phoneKey]: e.target.value }))}
                            placeholder="Phone"
                            className="px-3 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                          />
                          {section.emailKey && (
                            <input
                              type="email"
                              value={jobForm[section.emailKey] || ''}
                              onChange={(e) => setJobForm((prev) => ({ ...prev, [section.emailKey]: e.target.value }))}
                              placeholder="Email"
                              className="sm:col-span-2 px-3 py-2 bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Name</span>
                            <span className="text-slate-900 dark:text-slate-200">{(job as any)[section.nameKey] || <span className="text-amber-500 italic">Not set</span>}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Phone</span>
                            <span className="text-slate-900 dark:text-slate-200">{(job as any)[section.phoneKey] || <span className="text-amber-500 italic">Not set</span>}</span>
                          </div>
                          {section.emailKey && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">Email</span>
                              <span className="text-slate-900 dark:text-slate-200">{(job as any)[section.emailKey] || <span className="text-amber-500 italic">Not set</span>}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* QuickGuard Support Contact */}
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-customer-service-2-line text-teal-400 text-sm" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">QuickGuard Support</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Phone</span>
                    <span className="text-slate-900 dark:text-slate-200">0800 123 4567</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Email</span>
                    <span className="text-slate-900 dark:text-slate-200">support@quickguard.uk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Hours</span>
                    <span className="text-slate-900 dark:text-slate-200">24/7 Emergency Line</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">For guard no-shows, safety incidents, or urgent issues, call our emergency line immediately.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}