'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ClientMonitoringData {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  business_address: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  is_suspended: boolean | null;
  subscription_tier: string | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  trading_name: string | null;
  company_registration_number: string | null;
  vat_number: string | null;
  billing_email: string | null;
  billing_address: string | null;
  subscription: {
    status: string;
    plan_name: string;
    trial_end_date: string | null;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null;
  jobCounts: {
    total: number;
    active: number;
    posted: number;
    draft: number;
    completed: number;
    payment_pending: number;
    starting_soon_48h: number;
    no_applicants: number;
  };
  paymentStatus: {
    total_spent: number;
    failed_payments: number;
    pending_payments: number;
  };
  supportStatus: {
    open_tickets: number;
    urgent_tickets: number;
    awaiting_reply: number;
  };
  healthScore: number;
  healthStatus: 'healthy' | 'warning' | 'needs_attention' | 'critical';
  alerts: string[];
}

interface DetailProps {
  client: ClientMonitoringData;
  onClose: () => void;
  onUpdate: () => void;
}

interface JobData {
  id: string;
  job_title: string;
  status: string;
  start_date: string | null;
  venue_city: string | null;
  venue_name: string | null;
  guards_required: number;
  created_at: string;
  total_cost: number | null;
}

interface PaymentData {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  description: string | null;
}

interface TicketData {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  last_reply_at: string | null;
}

interface MessageData {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_name?: string;
}

interface DocumentData {
  id: string;
  file_name: string;
  file_type: string;
  created_at: string;
  document_type: string | null;
}

interface ContactData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
}

export default function ClientMonitoringDetail({ client, onClose, onUpdate }: DetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'payments' | 'tickets' | 'messages' | 'documents' | 'notes'>('overview');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(client.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const displayName = client.company_name || client.contact_name || 'Unknown Client';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'jobs') fetchJobs();
    if (activeTab === 'payments') fetchPayments();
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'messages') fetchMessages();
    if (activeTab === 'documents') fetchDocuments();
  }, [activeTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOverview = async () => {
    const { data: contactsData } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', client.id)
      .order('is_primary', { ascending: false });
    setContacts((contactsData || []) as ContactData[]);
  };

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('id, job_title, status, start_date, venue_city, venue_name, guards_required, created_at, total_cost')
      .eq('client_id', client.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setJobs((data || []) as JobData[]);
    setLoading(false);
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, description')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPayments((data || []) as PaymentData[]);
    setLoading(false);
  };

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, last_reply_at')
      .eq('client_id', client.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setTickets((data || []) as TicketData[]);
    setLoading(false);
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id')
      .or(`sender_id.eq.${client.user_id},receiver_id.eq.${client.user_id}`)
      .order('created_at', { ascending: false })
      .limit(20);
    setMessages((data || []) as MessageData[]);
    setLoading(false);
  };

  const fetchDocuments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_documents')
      .select('id, file_name, file_type, created_at, document_type')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setDocuments((data || []) as DocumentData[]);
    setLoading(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase.functions.invoke('admin-clients', {
        body: { action: 'update', id: client.id, updates: { notes: notesValue.trim() || null } },
      });
      if (error) {
        showToast('Failed to save notes');
      } else {
        setEditingNotes(false);
        showToast('Notes saved successfully');
      }
    } catch {
      showToast('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-sky-50 text-sky-700',
      active: 'bg-teal-50 text-teal-700',
      completed: 'bg-emerald-50 text-emerald-700',
      draft: 'bg-slate-50 text-slate-600',
      payment_pending: 'bg-amber-50 text-amber-700',
      cancelled: 'bg-red-50 text-red-700',
      'awaiting_client': 'bg-amber-50 text-amber-700',
      'under_review': 'bg-sky-50 text-sky-700',
      escalated: 'bg-red-50 text-red-700',
      resolved: 'bg-emerald-50 text-emerald-700',
      pending: 'bg-amber-50 text-amber-700',
      failed: 'bg-red-50 text-red-700',
      completed: 'bg-emerald-50 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-slate-50 text-slate-600'}`}>
        {status}
      </span>
    );
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Healthy</span>;
      case 'warning': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">Warning</span>;
      case 'needs_attention': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-100">Needs Attention</span>;
      case 'critical': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-100">Critical</span>;
      default: return null;
    }
  };

  const healthItems = [
    { label: 'Company profile complete', pass: client.profile_completed, icon: 'ri-user-line' },
    { label: 'Billing details added', pass: !!client.billing_email || !!client.billing_address, icon: 'ri-bank-card-line' },
    { label: 'Has active or past jobs', pass: client.jobCounts.total > 0, icon: 'ri-briefcase-line' },
    { label: 'Payment history exists', pass: client.paymentStatus.total_spent > 0, icon: 'ri-money-pound-circle-line' },
    { label: 'Active subscription', pass: client.subscription?.status === 'active', icon: 'ri-vip-crown-line' },
    { label: 'No failed payments', pass: client.paymentStatus.failed_payments === 0, icon: 'ri-error-warning-line' },
    { label: 'No urgent tickets', pass: client.supportStatus.urgent_tickets === 0, icon: 'ri-message-3-line' },
    { label: 'Recent activity', pass: client.last_login ? (Date.now() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24) < 30 : false, icon: 'ri-time-line' },
    { label: 'Account verified', pass: client.verified, icon: 'ri-shield-check-line' },
  ];

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-user-line' },
    { key: 'jobs', label: 'Jobs', icon: 'ri-briefcase-line' },
    { key: 'payments', label: 'Payments', icon: 'ri-money-pound-circle-line' },
    { key: 'tickets', label: 'Tickets', icon: 'ri-message-3-line' },
    { key: 'messages', label: 'Messages', icon: 'ri-chat-1-line' },
    { key: 'documents', label: 'Documents', icon: 'ri-file-list-line' },
    { key: 'notes', label: 'Notes', icon: 'ri-sticky-note-line' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-3xl h-full overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className="absolute top-4 left-4 right-4 z-30 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
            <i className="ri-checkbox-circle-fill"></i>
            {toast}
          </div>
        )}

        <div className="bg-gradient-to-r from-teal-600 to-sky-600 px-6 py-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-white/20 rounded-xl text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <p className="text-white/70 text-sm truncate">{client.contact_name}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {getHealthBadge(client.healthStatus)}
                {client.is_suspended && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/30 text-red-100">
                    <i className="ri-forbid-line"></i> Suspended
                  </span>
                )}
                {client.verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/30 text-emerald-100">
                    <i className="ri-checkbox-circle-fill"></i> Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-teal-600">{client.healthScore}%</p>
            <p className="text-xs text-slate-500">Health Score</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-sky-600">{client.jobCounts.total}</p>
            <p className="text-xs text-slate-500">Jobs</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">£{client.paymentStatus.total_spent.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Total Spent</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{client.supportStatus.open_tickets}</p>
            <p className="text-xs text-slate-500">Open Tickets</p>
          </div>
        </div>

        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className={t.icon}></i>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Company Information</h3>
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Company Name</p>
                    <p className="text-sm font-medium text-slate-900">{client.company_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Trading Name</p>
                    <p className="text-sm font-medium text-slate-900">{client.trading_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Company Reg Number</p>
                    <p className="text-sm font-medium text-slate-900">{client.company_registration_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">VAT Number</p>
                    <p className="text-sm font-medium text-slate-900">{client.vat_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Contact Name</p>
                    <p className="text-sm font-medium text-slate-900">{client.contact_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Email</p>
                    <p className="text-sm font-medium text-slate-900">{client.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Phone</p>
                    <p className="text-sm font-medium text-slate-900">{client.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Location</p>
                    <p className="text-sm font-medium text-slate-900">{[client.city, client.postcode].filter(Boolean).join(', ') || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {contacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Contacts</h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-teal-100 rounded-lg">
                            <i className="ri-user-line text-teal-600 text-sm"></i>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                            <p className="text-xs text-slate-500">{contact.role || 'Contact'} {contact.is_primary && <span className="text-teal-600 font-medium">(Primary)</span>}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-slate-500">
                          {contact.email && <p>{contact.email}</p>}
                          {contact.phone && <p>{contact.phone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Subscription</h3>
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="text-sm font-medium text-slate-900 capitalize">{client.subscription?.status || 'No subscription'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Plan</p>
                    <p className="text-sm font-medium text-slate-900">{client.subscription?.plan_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Trial End</p>
                    <p className="text-sm font-medium text-slate-900">
                      {client.subscription?.trial_end_date
                        ? new Date(client.subscription.trial_end_date).toLocaleDateString('en-GB')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Current Period End</p>
                    <p className="text-sm font-medium text-slate-900">
                      {client.subscription?.current_period_end
                        ? new Date(client.subscription.current_period_end).toLocaleDateString('en-GB')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Billing Email</p>
                    <p className="text-sm font-medium text-slate-900">{client.billing_email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Billing Address</p>
                    <p className="text-sm font-medium text-slate-900">{client.billing_address || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Health Checklist</h3>
                <div className="grid grid-cols-2 gap-3">
                  {healthItems.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        item.pass ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${item.pass ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <i className={`${item.icon} ${item.pass ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${item.pass ? 'text-emerald-700' : 'text-slate-500'}`}>{item.label}</p>
                        <p className="text-xs text-slate-400">{item.pass ? 'Complete' : 'Incomplete'}</p>
                      </div>
                      <i className={`ml-auto text-lg ${item.pass ? 'ri-check-fill text-emerald-500' : 'ri-close-fill text-slate-300'}`}></i>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Jobs</h3>
                <Link
                  href={`/admin/jobs?client_id=${client.id}`}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  View All <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : jobs.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <i className="ri-briefcase-line text-3xl text-slate-300 mb-2"></i>
                  <p className="text-slate-500 text-sm">No jobs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{job.job_title}</p>
                          <p className="text-xs text-slate-500">{job.venue_city || job.venue_name || '—'}</p>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB') : 'No start date'}</span>
                        <span>{job.guards_required} guards required</span>
                        <span>{job.total_cost ? `£${job.total_cost}` : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Payment History</h3>
                <Link
                  href={`/admin/payments?client_id=${client.id}`}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  View All <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Total Spent</p>
                    <p className="text-2xl font-bold text-emerald-700">£{client.paymentStatus.total_spent.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-medium">Failed Payments</p>
                    <p className="text-2xl font-bold text-emerald-700">{client.paymentStatus.failed_payments}</p>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : payments.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <i className="ri-money-pound-circle-line text-3xl text-slate-300 mb-2"></i>
                  <p className="text-slate-500 text-sm">No payment history</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 text-sm text-slate-700">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{p.description || '—'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">£{p.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">{getStatusBadge(p.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Support Tickets</h3>
                <Link
                  href={`/admin/support-tickets?client_id=${client.id}`}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  View All <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : tickets.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <i className="ri-message-3-line text-3xl text-slate-300 mb-2"></i>
                  <p className="text-slate-500 text-sm">No support tickets</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                          <p className="text-xs text-slate-500">
                            Created {new Date(ticket.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(ticket.status)}
                          {ticket.priority === 'urgent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              <i className="ri-alarm-warning-line text-xs"></i> Urgent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Messages</h3>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <i className="ri-chat-1-line text-3xl text-slate-300 mb-2"></i>
                  <p className="text-slate-500 text-sm">No messages found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-sm text-slate-700 mb-2">{msg.content}</p>
                      <p className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString('en-GB')} at {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Uploaded Documents</h3>
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <i className="ri-file-list-line text-3xl text-slate-300 mb-2"></i>
                  <p className="text-slate-500 text-sm">No documents uploaded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-sky-50 rounded-xl">
                        <i className="ri-file-line text-sky-600"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{doc.file_name}</p>
                        <p className="text-xs text-slate-500">{doc.document_type || 'Document'} · {doc.file_type}</p>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Admin Notes</h3>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                  >
                    <i className="ri-edit-line"></i> {client.notes ? 'Edit' : 'Add Notes'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    maxLength={500}
                    placeholder="Add internal notes about this client..."
                    className="w-full h-32 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{notesValue.length}/500</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setNotesValue(client.notes || ''); setEditingNotes(false); }}
                        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-amber-100 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                      >
                        {savingNotes ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 min-h-[80px]">
                  {client.notes ? (
                    <p className="text-sm text-slate-700">{client.notes}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No admin notes yet. Click "Add Notes" to add one.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}