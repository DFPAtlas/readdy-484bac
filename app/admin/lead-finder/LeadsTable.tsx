'use client';

interface Lead {
  id: string;
  company_name: string | null;
  sector: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number | null;
  status: string | null;
  email_status: string | null;
  last_scanned_at: string | null;
  website_url: string | null;
  contact_page_url: string | null;
  opt_out: boolean | null;
}

interface Props {
  leads: Lead[];
  onSelect: (l: Lead) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    contacted: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
    not_suitable: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20',
    converted: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
    archived: 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20',
  };
  const label = (status || 'new').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status ?? 'new'] ?? 'bg-blue-500/10 text-blue-400'}`}>
      {label}
    </span>
  );
}

function EmailStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    not_sent: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20',
    queued: 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
    sent: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    replied: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
    bounced: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
    unsubscribed: 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
  };
  const label = (status || 'not_sent').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status ?? 'not_sent'] ?? 'bg-slate-500/10 text-slate-400'}`}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  let cls = 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20';
  if (s >= 80) cls = 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20';
  else if (s >= 60) cls = 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20';
  else if (s >= 40) cls = 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>
      {s}
    </span>
  );
}

export default function LeadsTable({ leads, onSelect, selectedIds, onToggleSelect, onToggleAll }: Props) {
  if (leads.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#1a2b4a] rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-user-search-line text-3xl text-slate-500"></i>
        </div>
        <p className="text-lg font-semibold text-slate-300">No leads found</p>
        <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <tr>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-[#1a2b4a] bg-[#111d35] text-teal-500 focus:ring-teal-500/30 cursor-pointer"
                />
              </th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sector</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Scanned</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {leads.map(l => (
              <tr key={l.id} className={`hover:bg-[#1a2b4a]/30 transition-colors ${selectedIds.includes(l.id) ? 'bg-teal-500/5' : ''}`}>
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(l.id)}
                    onChange={() => onToggleSelect(l.id)}
                    className="w-4 h-4 rounded border-[#1a2b4a] bg-[#111d35] text-teal-500 focus:ring-teal-500/30 cursor-pointer"
                  />
                </td>
                <td className="px-5 py-4">
                  <div>
                    <p className="font-semibold text-slate-200 text-sm whitespace-nowrap">{l.company_name || '\u2014'}</p>
                    {l.opt_out && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 mt-0.5">
                        <i className="ri-forbid-2-line text-[10px]"></i>
                        Opted Out
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">{l.sector || '\u2014'}</td>
                <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap max-w-[140px] truncate">{l.location || '\u2014'}</td>
                <td className="px-5 py-4 text-teal-400 text-sm max-w-[180px] truncate">{l.email || '\u2014'}</td>
                <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">{l.phone || '\u2014'}</td>
                <td className="px-5 py-4"><ScoreBadge score={l.lead_score} /></td>
                <td className="px-5 py-4"><StatusBadge status={l.status} /></td>
                <td className="px-5 py-4"><EmailStatusBadge status={l.email_status} /></td>
                <td className="px-5 py-4 text-slate-500 text-sm whitespace-nowrap">
                  {l.last_scanned_at
                    ? new Date(l.last_scanned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '\u2014'}
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => onSelect(l)}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-400 border border-teal-500/30 rounded-lg hover:bg-teal-500/10 hover:border-teal-500/40 cursor-pointer whitespace-nowrap transition"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}