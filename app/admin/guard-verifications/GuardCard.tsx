'use client';

import QuickGuardImage from '@/components/QuickGuardImage';

import { GuardVerification, getStatusBadge, getWarningBadges, getSiaCheckStatusBadge, getSiaCheckStatusText, formatDate, hasExpiredLicence } from './types';

interface GuardCardProps {
  guard: GuardVerification;
  onReview: () => void;
  onRequestInfo: () => void;
}

export default function GuardCard({ guard, onReview, onRequestInfo }: GuardCardProps) {
  const name = guard.full_name || 'Unnamed guard';
  const status = getStatusBadge(guard.verification_status || 'pending');
  const sia = getSiaCheckStatusBadge(guard.sia_check_status, guard.verification_status, guard);
  const warnings = getWarningBadges(guard);
  return (
    <article aria-labelledby={`guard-card-${guard.id}`} className="h-full min-w-0 flex flex-col gap-2.5 rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-4 shadow-sm hover:border-teal-500/40 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a2b4a] flex-shrink-0 border border-[#243552]">
            {guard.profile_image_url ? (
              <QuickGuardImage src={guard.profile_image_url} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div aria-hidden="true" className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-sky-500/20 text-lg font-bold text-teal-300">
                {name.trim().charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id={`guard-card-${guard.id}`} className="text-sm font-bold text-white break-words">{name}</h3>
            <p className="mt-1 text-xs text-slate-400 break-all">{guard.email || 'Email not provided'}</p>
            <p className="mt-0.5 text-xs text-slate-400 break-words">{guard.phone || 'Phone not provided'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ring-1 ${status.color}`}>{status.label}</span>
          <span title={getSiaCheckStatusText(guard.sia_check_status, guard.verification_status, guard)} className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ring-1 ${sia.color}`}>SIA: {sia.label}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-[#0a1628] p-3 text-xs">
          <div className="col-span-2 min-w-0">
            <dt className="inline text-slate-400">SIA: </dt>
            <dd className="inline font-mono text-slate-200 break-words">{guard.sia_licence_number || 'Not provided'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-400">Exp: </dt>
            <dd className={`inline ${hasExpiredLicence(guard) ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>{formatDate(guard.sia_expiry_date)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-400">Joined: </dt>
            <dd className="inline text-slate-300">{formatDate(guard.created_at)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="sr-only">Location</dt>
            <dd className="text-slate-300 break-words">{guard.city || guard.postcode || guard.location || 'Location not provided'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="sr-only">Experience and hourly rate</dt>
            <dd className="text-slate-300">{guard.years_experience != null ? `${guard.years_experience} yrs` : '—'}{guard.hourly_rate != null && <span className="text-slate-400"> · £{guard.hourly_rate}/hr</span>}</dd>
          </div>
        </dl>

        {guard.licence_types && guard.licence_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {guard.licence_types.map((type, index) => <span key={`${type}-${index}`} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 text-[10px] break-words">{type.replace(/_/g, ' ')}</span>)}
          </div>
        )}

        {warnings.length > 0 && <div className="flex flex-wrap gap-1">{warnings.map(warning => <span key={warning.label} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${warning.color}`}>{warning.label}</span>)}</div>}

      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[#1a2b4a] pt-3">
        <button onClick={onRequestInfo} aria-label={`Request information from ${name}`} className="px-2 py-2.5 bg-[#1a2b4a] text-slate-300 rounded-lg text-xs font-semibold hover:bg-[#243452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
          Request info
        </button>
        <button
          onClick={onReview}
          aria-label={`View ${name} profile`}
          className="px-2 py-2.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300"
        >
          View profile
        </button>
      </div>
    </article>
  );
}
