'use client';

import { GuardVerification, getStatusBadge, getWarningBadges, formatDate } from './types';

interface GuardTableProps {
  guards: GuardVerification[];
  onReview: (guard: GuardVerification) => void;
  onRequestInfo: (guard: GuardVerification) => void;
}

export default function GuardTable({ guards, onReview, onRequestInfo }: GuardTableProps) {
  return (
    <table className="w-full text-left border-collapse">
      <thead className="bg-[#1a2b4a]">
        <tr>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[240px]">Guard</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[170px]">SIA Licence</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[110px]">Status</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[150px]">Alerts</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[100px]">Registered</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[100px]">Location</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[90px]">Experience</th>
          <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right w-[170px]">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a2b4a]">
        {guards.map((guard) => {
          const statusBadge = getStatusBadge(guard.verification_status || 'pending');
          const warnings = getWarningBadges(guard);
          const isExpired = guard.sia_expiry_date && new Date(guard.sia_expiry_date) < new Date();
          return (
            <tr key={guard.id} className="hover:bg-[#0a1628]/50 transition-colors">
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a2b4a] flex-shrink-0 border border-[#1a2b4a]">
                    {guard.profile_image_url ? (
                      <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-sky-500/20">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-user-line text-teal-400 text-sm"></i>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{guard.full_name || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{guard.email || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{guard.phone || '—'}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-mono text-slate-300">{guard.sia_licence_number || '—'}</p>
                  <p className={`text-xs ${isExpired ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
                    Exp: {formatDate(guard.sia_expiry_date)}
                    {isExpired && <span className="ml-1 text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">EXP</span>}
                  </p>
                  {guard.licence_types && guard.licence_types.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {guard.licence_types.slice(0, 2).map((lt, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full">
                          {lt.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {guard.licence_types.length > 2 && (
                        <span className="px-1.5 py-0.5 text-slate-500 text-[10px]">+{guard.licence_types.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 whitespace-nowrap ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
                {guard.sia_check_status && (
                  <span className={`block mt-1 text-[10px] ${
                    guard.sia_check_status === 'passed' ? 'text-emerald-400' :
                    guard.sia_check_status === 'failed' ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    SIA: {guard.sia_check_status}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {warnings.length === 0 ? (
                    <span className="text-xs text-slate-500">—</span>
                  ) : (
                    warnings.map((w, i) => (
                      <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 whitespace-nowrap ${w.color}`}>
                        {w.label}
                      </span>
                    ))
                  )}
                </div>
                {guard.profile_completed === false && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 bg-slate-500/10 text-slate-400 mt-1 whitespace-nowrap">
                    Incomplete
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <span className="text-sm text-slate-400 whitespace-nowrap">{formatDate(guard.created_at)}</span>
              </td>
              <td className="px-3 py-3">
                <span className="text-sm text-slate-400 truncate block max-w-[100px]">
                  {guard.city || guard.postcode || guard.location || '—'}
                </span>
              </td>
              <td className="px-3 py-3">
                <span className="text-sm text-slate-300 whitespace-nowrap">
                  {guard.years_experience != null ? `${guard.years_experience} yrs` : '—'}
                </span>
                {guard.hourly_rate != null && (
                  <span className="block text-xs text-slate-500 whitespace-nowrap">£{guard.hourly_rate}/hr</span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onRequestInfo(guard)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a2b4a] text-slate-300 hover:bg-[#243452] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-mail-send-line text-xs"></i>
                    </div>
                    Info
                  </button>
                  <button
                    onClick={() => onReview(guard)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-500 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-eye-line text-xs"></i>
                    </div>
                    View
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}