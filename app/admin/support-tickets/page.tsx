'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface SupportTicket {
  id: string;
  ticket_reference: string | null;
  client_id: string;
  guard_id: string | null;
  related_job_id: string | null;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  contact_preference: string | null;
  admin_notes: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  client_name?: string;
  client_email?: string;
  guard_name?: string;
  job_title?: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 ring-sky-100',
  pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  in_progress: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 ring-red-100',
  high: 'bg-orange-50 text-orange-700 ring-orange-100',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100',
  low: 'bg-slate-50 text-slate-600 ring-slate-100',
};

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filtered, setFiltered] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) { setTickets([]); setLoading(false); return; }

      const clientIds = [...new Set(data.map((t: any) => t.client_id).filter(Boolean))];
      const guardIds = [...new Set(data.map((t: any) => t.guard_id).filter(Boolean))];
      const jobIds = [...new Set(data.map((t: any) => t.related_job_id).filter(Boolean))];

      const [clientsRes, guardsRes, jobsRes] = await Promise.all([
        clientIds.length > 0 ? supabase.from('clients').select('id, company_name, email').in('id', clientIds) : Promise.resolve({ data: [] }),
        guardIds.length > 0 ? supabase.from('guards').select('id, full_name').in('id', guardIds) : Promise.resolve({ data: [] }),
        jobIds.length > 0 ? supabase.from('jobs').select('id, job_title').in('id', jobIds) : Promise.resolve({ data: [] }),
      ]);

      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
      const guardMap = new Map((guardsRes.data || []).map((g: any) => [g.id, g]));
      const jobMap = new Map((jobsRes.data || []).map((j: any) => [j.id, j]));

      const enriched: SupportTicket[] = (data || []).map((t: any) => {
        const client = clientMap.get(t.client_id);
        const guard = guardMap.get(t.guard_id);
        const job = jobMap.get(t.related_job_id);
        return {
          ...t,
          client_name: client?.company_name || 'Unknown',
          client_email: client?.email || '',
          guard_name: guard?.full_name || null,
          job_title: job?.job_title || null,
        };
      });

      setTickets(enriched);
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    let result = [...tickets];
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.ticket_reference || '').toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.client_name || '').toLowerCase().includes(q) ||
        (t.guard_name || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [tickets, search, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const handleSaveNote = async () => {
    if (!selected || !adminNote.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ admin_notes: adminNote, updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (error) throw error;
      setToast({ message: 'Notes saved', type: 'success' });
      setSelected({ ...selected, admin_notes: adminNote });
      fetchTickets();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to save notes', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
      const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
      if (error) throw error;
      setToast({ message: `Ticket marked as ${newStatus}`, type: 'success' });
      if (selected?.id === ticketId) setSelected({ ...selected, status: newStatus });
      fetchTickets();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to update status', type: 'error' });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const categories = [...new Set(tickets.map(t => t.category).filter(Boolean))];

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border text-sm font-semibold ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill text-emerald-600' : 'ri-error-warning-fill text-red-600'} text-lg`}></i>
          </div>
          {toast.message}
        </div>
      )}

      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/admin/dashboard" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] transition-colors text-slate-400">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-customer-service-2-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Support Tickets</h1>
                <p className="text-xs text-slate-400">Manage client and guard support requests</p>
              </div>
            </div>
            <button
              onClick={fetchTickets}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] cursor-pointer whitespace-nowrap transition-colors"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-refresh-line"></i>
              </div>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: 'ri-file-list-3-line', color: 'bg-slate-100 text-slate-700' },
            { label: 'Open', value: stats.open, icon: 'ri-mail-open-line', color: 'bg-sky-100 text-sky-700' },
            { label: 'In Progress', value: stats.inProgress, icon: 'ri-loader-4-line', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Resolved', value: stats.resolved, icon: 'ri-check-double-line', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Urgent', value: stats.urgent, icon: 'ri-alert-line', color: 'bg-red-100 text-red-700' },
          ].map(s => (
            <div key={s.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-500/10 text-slate-400">
                  <i className={`${s.icon} text-base`}></i>
                </div>
                <span className="text-xs font-medium text-slate-400">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400">
              <i className="ri-search-line"></i>
            </div>
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#111d35] text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium bg-[#111d35] text-white cursor-pointer pr-8">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium bg-[#111d35] text-white cursor-pointer pr-8">
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {categories.length > 0 && (
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium bg-[#111d35] text-white cursor-pointer pr-8">
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400">Showing {filtered.length} of {tickets.length} tickets</p>
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a1a2f] border-b border-[#1a2b4a]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Ref</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Requester</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Created</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2b4a]">
                    {filtered.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-[#0a1a2f]/50 transition-colors cursor-pointer" onClick={() => { setSelected(ticket); setAdminNote(ticket.admin_notes || ''); }}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-400">{ticket.ticket_reference || ticket.id.slice(0, 8).toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">{ticket.subject}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-300">{ticket.client_name}</p>
                          {ticket.client_email && <p className="text-xs text-slate-500">{ticket.client_email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-slate-400 capitalize">{ticket.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${priorityColors[ticket.priority] || 'bg-slate-50 text-slate-600 ring-slate-100'}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${statusColors[ticket.status] || 'bg-slate-50 text-slate-600 ring-slate-100'}`}>
                            {ticket.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-teal-600 hover:text-teal-700 text-xs font-semibold whitespace-nowrap">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 flex items-center justify-center bg-slate-100 rounded-2xl mx-auto mb-4">
                    <i className="ri-customer-service-2-line text-3xl text-slate-400"></i>
                  </div>
                  <p className="text-slate-500 font-medium">No support tickets found</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl border border-[#1a2b4a]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#111d35] border-b border-[#1a2b4a] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-white">{selected.subject}</h2>
                <p className="text-xs text-slate-400">{selected.ticket_reference || selected.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] text-slate-400">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#0a1628] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${statusColors[selected.status] || ''}`}>
                    {selected.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${priorityColors[selected.priority] || ''}`}>
                    {selected.priority}
                  </span>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Category</p>
                  <p className="text-sm font-semibold text-white capitalize">{selected.category}</p>
                </div>
                <div className="bg-[#0a1628] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Requester</p>
                  <p className="text-sm font-semibold text-white">{selected.client_name}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Description</p>
                <div className="bg-[#0a1628] rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap">{selected.description}</div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Admin Notes</p>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={500} className="w-full px-4 py-3 rounded-xl border border-[#1a2b4a] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none h-24 bg-[#0a1628] text-white placeholder-slate-500" placeholder="Add internal notes..." />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{adminNote.length}/500</span>
                  <button onClick={handleSaveNote} disabled={saving || !adminNote.trim()} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 disabled:opacity-50 whitespace-nowrap transition-colors">{saving ? 'Saving...' : 'Save Notes'}</button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {['open', 'pending', 'in_progress', 'resolved', 'closed'].map(s => (
                    <button key={s} onClick={() => handleChangeStatus(selected.id, s)} disabled={selected.status === s} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                        selected.status === s ? 'bg-[#1a2b4a] text-slate-500 cursor-default' : 'bg-[#1a2b4a] text-slate-400 hover:bg-[#1e2d4d] hover:text-white'
                      }`}>{s.replace(/_/g, ' ')}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setSelected(null)} className="w-full py-3 bg-[#1a2b4a] text-slate-400 rounded-xl font-semibold hover:bg-[#1e2d4d] hover:text-white transition-colors whitespace-nowrap">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}