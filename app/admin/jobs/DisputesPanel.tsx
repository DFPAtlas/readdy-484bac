'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import DisputeFilterTabs from './DisputeFilterTabs';
import DisputeCard from './DisputeCard';
import DisputeResolveModal from './DisputeResolveModal';

interface Dispute {
  id: string;
  job_id: string;
  client_id: string;
  guard_id: string;
  assignment_id: string | null;
  raised_by: string;
  reason: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  resolution: string | null;
  refund_amount: number | null;
  admin_decided_by: string | null;
  stripe_refund_id: string | null;
  stripe_transfer_id: string | null;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
  jobs: { job_title: string; venue_city: string; agreed_amount: number; currency: string } | null;
  guards: { full_name: string; email: string } | null;
  clients: { company_name: string; email: string } | null;
}

const statusBadge: Record<string, string> = {
  open: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  under_review: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  resolved_guard: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  resolved_client_refund: 'bg-red-500/15 text-red-400 border border-red-500/25',
  resolved_client_partial: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  resolved_cancelled: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_guard: 'Resolved — Guard Paid',
  resolved_client_refund: 'Resolved — Full Refund',
  resolved_client_partial: 'Resolved — Partial Refund',
  resolved_cancelled: 'Resolved — Cancelled',
};

export default function DisputesPanel() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolving, setResolving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          jobs:job_id (job_title, venue_city, agreed_amount, currency),
          guards:guard_id (full_name, email),
          clients:client_id (company_name, email)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDisputes(data || []);
    } catch (err: any) {
      console.error('Failed to load disputes:', err);
      setToast({ message: 'Failed to load disputes', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const filtered = disputes.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'open') return d.status === 'open' || d.status === 'under_review';
    if (filter === 'resolved') return d.status.startsWith('resolved_');
    return d.status === filter;
  });

  const handleResolve = async (resolution: string) => {
    if (!selected) return;
    setResolving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            dispute_id: selected.id,
            resolution,
            refund_amount: parseFloat(refundAmount || '0'),
            admin_notes: adminNotes,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve dispute');
      setToast({ message: 'Dispute resolved successfully', type: 'success' });
      setSelected(null);
      setAdminNotes('');
      setRefundAmount('');
      await loadDisputes();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to resolve dispute', type: 'error' });
    } finally {
      setResolving(false);
    }
  };

  const handleSelectDispute = (dispute: Dispute) => {
    setSelected(dispute);
    setAdminNotes(dispute.admin_notes || '');
    setRefundAmount(dispute.refund_amount ? String(dispute.refund_amount) : '');
  };

  const openCount = disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length;
  const resolvedCount = disputes.filter((d) => d.status.startsWith('resolved_')).length;
  const totalDisputedAmount = disputes
    .filter((d) => d.status === 'open' || d.status === 'under_review')
    .reduce((sum, d) => sum + (d.jobs?.agreed_amount || 0), 0);

  return (
    <div className="mt-8 bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
      <DisputeFilterTabs
        filter={filter}
        onFilterChange={setFilter}
        openCount={openCount}
        resolvedCount={resolvedCount}
        totalDisputedAmount={totalDisputedAmount}
      />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#0a1527] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#0a1527] rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-3xl text-slate-500"></i>
            </div>
            <h3 className="font-semibold text-white">No disputes found</h3>
            <p className="text-sm text-slate-400">All jobs are running smoothly</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((dispute) => (
              <DisputeCard
                key={dispute.id}
                id={dispute.id}
                jobTitle={dispute.jobs?.job_title || 'Unknown Job'}
                status={dispute.status}
                statusLabel={statusLabel[dispute.status] || dispute.status}
                statusBadgeClass={statusBadge[dispute.status] || statusBadge.open}
                clientName={dispute.clients?.company_name || 'Unknown Client'}
                guardName={dispute.guards?.full_name || 'Unknown Guard'}
                amount={dispute.jobs?.agreed_amount || 0}
                currency={dispute.jobs?.currency || 'GBP'}
                reason={dispute.reason}
                createdAt={dispute.created_at}
                raisedBy={dispute.raised_by}
                onClick={() => handleSelectDispute(dispute)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DisputeResolveModal
          jobTitle={selected.jobs?.job_title || 'Unknown Job'}
          venueCity={selected.jobs?.venue_city}
          clientName={selected.clients?.company_name || 'Unknown Client'}
          guardName={selected.guards?.full_name || 'Unknown Guard'}
          amount={selected.jobs?.agreed_amount || 0}
          createdAt={selected.created_at}
          reason={selected.reason}
          details={selected.details}
          adminNotes={adminNotes}
          refundAmount={refundAmount}
          resolving={resolving}
          onAdminNotesChange={setAdminNotes}
          onRefundAmountChange={setRefundAmount}
          onResolve={handleResolve}
          onClose={() => setSelected(null)}
        />
      )}

      {toast && (
        <div className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          <i className={`text-lg ${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}