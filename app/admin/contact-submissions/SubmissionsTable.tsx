'use client';

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  category: string | null;
  status: string;
  source: string | null;
  created_at: string;
  user_id?: string | null;
}

interface Props {
  submissions: Submission[];
  onSelect: (s: Submission) => void;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'in progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status.toLowerCase()] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {status}
    </span>
  );
}

export default function SubmissionsTable({ submissions, onSelect }: Props) {
  if (submissions.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#1a2b4a] rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-mail-line text-3xl text-slate-500"></i>
        </div>
        <p className="text-lg font-semibold text-white">No submissions found</p>
        <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <tr>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {submissions.map(s => (
              <tr key={s.id} className="hover:bg-[#0a1628]/50 transition-colors">
                <td className="px-5 py-4 font-semibold text-white text-sm whitespace-nowrap">{s.name}</td>
                <td className="px-5 py-4 text-slate-300 text-sm whitespace-nowrap">{s.email}</td>
                <td className="px-5 py-4 text-slate-300 text-sm whitespace-nowrap">{s.phone ?? '—'}</td>
                <td className="px-5 py-4 text-slate-300 text-sm max-w-xs truncate">{s.subject ?? '—'}</td>
                <td className="px-5 py-4 text-slate-300 text-sm whitespace-nowrap">
                  {s.category ?? '—'}
                </td>
                <td className="px-5 py-4"><StatusBadge status={s.status} /></td>
                <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">
                  {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => onSelect(s)}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500/10 hover:border-teal-500/30 cursor-pointer whitespace-nowrap transition"
                  >
                    Manage
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