'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface WebhookEvent {
  id: string;
  event_type: string;
  event_source: string | null;
  stripe_event_id: string | null;
  related_table: string | null;
  related_id: string | null;
  user_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  processed: boolean | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  event_data: any;
}

export default function StripeWebhookLog() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load webhook events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filtered = events.filter((e) => {
    const matchesFilter = filter === 'all' ||
      (filter === 'processed' && e.processed) ||
      (filter === 'failed' && !e.processed) ||
      e.event_type === filter;
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      e.event_type?.toLowerCase().includes(q) ||
      e.stripe_event_id?.toLowerCase().includes(q) ||
      e.error_message?.toLowerCase().includes(q) ||
      e.status?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: events.length,
    processed: events.filter(e => e.processed).length,
    failed: events.filter(e => !e.processed).length,
    payment_intent_succeeded: events.filter(e => e.event_type === 'payment_intent.succeeded').length,
    payment_intent_failed: events.filter(e => e.event_type === 'payment_intent.payment_failed').length,
    charge_refunded: events.filter(e => e.event_type === 'charge.refunded').length,
    transfer_created: events.filter(e => e.event_type === 'transfer.created').length,
  };

  const filterButtons = [
    { key: 'all', label: 'All', count: counts.all, color: 'text-slate-300 bg-[#1a2b4a] ring-[#1e3048]' },
    { key: 'processed', label: 'Processed', count: counts.processed, color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
    { key: 'failed', label: 'Failed', count: counts.failed, color: 'text-red-400 bg-red-500/10 ring-red-500/20' },
    { key: 'payment_intent.succeeded', label: 'Succeeded', count: counts.payment_intent_succeeded, color: 'text-teal-400 bg-teal-500/10 ring-teal-500/20' },
    { key: 'payment_intent.payment_failed', label: 'Failed Pay', count: counts.payment_intent_failed, color: 'text-orange-400 bg-orange-500/10 ring-orange-500/20' },
    { key: 'charge.refunded', label: 'Refunded', count: counts.charge_refunded, color: 'text-rose-400 bg-rose-500/10 ring-rose-500/20' },
    { key: 'transfer.created', label: 'Transfers', count: counts.transfer_created, color: 'text-blue-400 bg-blue-500/10 ring-blue-500/20' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-white">Stripe Webhook Log</h3>
          <p className="text-sm text-slate-400">Payment events processed from Stripe</p>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line text-sm"></i>
          </div>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {filterButtons.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl ring-1 px-2 py-2 text-center transition-all cursor-pointer ${s.color} ${filter === s.key ? 'ring-2 shadow-sm' : ''}`}
          >
            <p className="text-lg font-extrabold">{s.count}</p>
            <p className="text-[10px] font-semibold mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <i className="ri-search-line text-lg"></i>
        </div>
        <input
          type="text"
          placeholder="Search event types, Stripe IDs, or errors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-slate-200 placeholder:text-slate-500 bg-[#1a2b4a]/50 transition-all"
        />
      </div>

      {loading ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading events...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-12 h-12 bg-[#1a2b4a] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e3048]">
            <i className="ri-plug-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400">No webhook events found</p>
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2b4a] border-b border-[#1e3048]">
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Event Type</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Stripe Event ID</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Processed</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Error</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-500/10 text-slate-300 text-xs font-bold ring-1 ring-slate-500/20">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-plug-line text-[10px]"></i>
                        </div>
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-[160px] truncate">
                      {event.stripe_event_id || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        event.status === 'succeeded' || event.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : event.status === 'failed'
                          ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                          : 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20'
                      }`}>
                        {event.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        event.processed
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                      }`}>
                        <div className="w-2.5 h-2.5 flex items-center justify-center">
                          <i className={`${event.processed ? 'ri-check-line' : 'ri-close-line'} text-[8px]`}></i>
                        </div>
                        {event.processed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      {event.amount ? `£${Number(event.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-400 max-w-[200px] truncate">
                      {event.error_message || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e3048] text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="View event data"
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-code-box-line text-sm"></i>
                          </div>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#1a2b4a] text-xs text-slate-500 font-medium">
            {filtered.length} events shown
          </div>
        </div>
      )}

      {/* Event Data Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl ring-1 ring-[#1a2b4a] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Event Data</h3>
              <button onClick={() => setSelectedEvent(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(selectedEvent.event_data, null, 2)}
              </pre>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSelectedEvent(null)} className="px-4 py-2 bg-[#1a2b4a] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e3048] transition-all cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}