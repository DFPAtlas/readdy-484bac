'use client';

import { GuardVerification, getStatusBadge, getWarningBadges, formatDateShort } from './types';

interface GuardMobileCardProps {
  guard: GuardVerification;
  onReview: () => void;
  onRequestInfo: () => void;
}

export default function GuardMobileCard({ guard, onReview, onRequestInfo }: GuardMobileCardProps) {
  const statusBadge = getStatusBadge(guard.verification_status || 'pending');
  const warnings = getWarningBadges(guard);
  const isExpired = guard.sia_expiry_date && new Date(guard.sia_expiry_date) < new Date();

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a2b4a] flex-shrink-0 border border-[#1a2b4a]">
          {guard.profile_image_url ? (
            <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-sky-500/20">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-user-line text-teal-400"></i>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white truncate">{guard.full_name || 'Unknown'}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 flex-shrink-0 ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{guard.email}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {warnings.map((w, i) => (
              <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ring-1 ${w.color}`}>
                {w.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
            <div>
              <span className="text-slate-500">Phone:</span>
              <span className="text-slate-300 ml-1">{guard.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">SIA:</span>
              <span className="text-slate-300 ml-1 font-mono">{guard.sia_licence_number || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Expiry:</span>
              <span className={`ml-1 ${isExpired ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>
                {formatDateShort(guard.sia_expiry_date)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Created:</span>
              <span className="text-slate-300 ml-1">{formatDateShort(guard.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-500">Location:</span>
              <span className="text-slate-300 ml-1">{guard.city || guard.postcode || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Exp:</span>
              <span className="text-slate-300 ml-1">{guard.years_experience != null ? `${guard.years_experience} yrs` : '—'}</span>
            </div>
          </div>
          {guard.licence_types && guard.licence_types.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {guard.licence_types.map((lt, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full">
                  {lt.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onRequestInfo}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#1a2b4a] text-slate-300 hover:bg-[#243452] transition-colors cursor-pointer"
            >
              <div className="w-3 h-3 flex items-center justify-center">
                <i className="ri-mail-send-line text-xs"></i>
              </div>
              Request Info
            </button>
            <button
              onClick={onReview}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-500 transition-colors cursor-pointer"
            >
              <div className="w-3 h-3 flex items-center justify-center">
                <i className="ri-eye-line text-xs"></i>
              </div>
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}