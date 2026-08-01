'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuditEntry {
  id: string;
  action_type: string;
  previous_value: string | null;
  new_value: string | null;
  note: string | null;
  performed_by: string;
  created_at: string;
}

interface Props {
  complaintId: string;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
  status_change:   { icon: 'ri-arrow-right-circle-line', color: 'text-teal-400',  bg: 'bg-teal-500/10',  border: 'border-teal-500/20', label: 'Status Changed'   },
  admin_note:      { icon: 'ri-sticky-note-line',        color: 'text-sky-400',   bg: 'bg-sky-500/10',   border: 'border-sky-500/20',   label: 'Admin Note Added' },
  resolution_note: { icon: 'ri-checkbox-circle-line',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Resolution Added' },
  created:         { icon: 'ri-file-add-line',           color: 'text-slate-400', bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  label: 'Complaint Filed'  },
};

const STATUS_COLORS: Record<string, string> = {
  open:         'bg-red-500/10 text-red-400 border-red-500/20',
  under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  resolved:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function StatusPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-500 italic text-xs">none</span>;
  const cls = STATUS_COLORS[value] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

export default function ComplaintTimeline({ complaintId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('complaint_audit_trail')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });
      setEntries(data ?? []);
      setLoading(false);
    };
    load();
  }, [complaintId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 bg-[#1a2b4a] rounded-xl flex items-center justify-center mb-2">
          <i className="ri-time-line text-xl text-slate-500"></i>
        </div>
        <p className="text-sm text-slate-400">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-[#1a2b4a]"></div>
      <div className="space-y-4">
        {entries.map((entry) => {
          const cfg = ACTION_CONFIG[entry.action_type] ?? ACTION_CONFIG.created;
          return (
            <div key={entry.id} className="flex gap-4 relative">
              <div className={`relative z-10 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border ${cfg.bg} ${cfg.border}`}>
                <i className={`${cfg.icon} text-base ${cfg.color}`}></i>
              </div>
              <div className="flex-1 bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{cfg.label}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                    {new Date(entry.created_at).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                {entry.action_type === 'status_change' && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusPill value={entry.previous_value} />
                    <div className="w-4 h-4 flex items-center justify-center text-slate-500">
                      <i className="ri-arrow-right-line text-xs"></i>
                    </div>
                    <StatusPill value={entry.new_value} />
                  </div>
                )}

                {(entry.action_type === 'admin_note' || entry.action_type === 'resolution_note') && entry.new_value && (
                  <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {entry.new_value}
                  </p>
                )}

                {entry.note && (
                  <p className="text-xs text-slate-500 mt-1.5 italic">{entry.note}</p>
                )}

                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <span className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-user-line"></i>
                  </span>
                  {entry.performed_by}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}