'use client';

import { GuardVerification, getSiaCheckStatusBadge } from './types';

interface SIALicenseSectionProps {
  guard: GuardVerification;
  hasLicenceImages: boolean;
  onViewLicence: () => void;
}

export default function SIALicenseSection({ guard, hasLicenceImages, onViewLicence }: SIALicenseSectionProps) {
  const siaBadge = getSiaCheckStatusBadge(guard.sia_check_status, guard.verification_status);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="text-slate-400">SIA License Number:</span>
          <p className="font-medium text-slate-200 font-mono">{guard.sia_licence_number || 'Not provided'}</p>
        </div>
        <div>
          <span className="text-slate-400">Cardholder Name:</span>
          <p className="font-medium text-slate-200">{guard.license_cardholder_name || 'Not provided'}</p>
        </div>
        <div>
          <span className="text-slate-400">Expiry Date:</span>
          <p className="font-medium text-slate-200">
            {guard.sia_expiry_date ? new Date(guard.sia_expiry_date).toLocaleDateString() : 'Not provided'}
          </p>
        </div>
        <div>
          <span className="text-slate-400">Licence Images:</span>
          <p className="font-medium text-slate-200">
            {hasLicenceImages ? (
              <span className="text-emerald-400">
                <i className="ri-check-line mr-1 w-3 h-3 inline-flex items-center justify-center"></i>
                {guard.sia_licence_front_url && guard.sia_licence_back_url ? 'Front + Back' : 'Front only'}
              </span>
            ) : (
              <span className="text-amber-400">Not uploaded</span>
            )}
          </p>
        </div>
      </div>

      {(guard.sia_check_status || guard.sia_confidence_score != null) && (
        <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${siaBadge.color} inline-flex items-center gap-1.5`}>
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={`${siaBadge.icon} text-xs`}></i>
              </div>
              {siaBadge.label}
            </span>
            {guard.sia_confidence_score != null && (
              <span className="text-xs text-slate-400">
                Confidence: {guard.sia_confidence_score}%
              </span>
            )}
          </div>
          {guard.sia_scraped_name && (
            <p className="text-xs text-slate-400">Scraped name: {guard.sia_scraped_name}</p>
          )}
          {guard.sia_scraped_status && (
            <p className="text-xs text-slate-400">Scraped status: {guard.sia_scraped_status}</p>
          )}
          {guard.sia_mismatch_reason && (
            <p className="text-xs text-red-400 mt-1">Mismatch: {guard.sia_mismatch_reason}</p>
          )}
          {guard.sia_checked_at && (
            <p className="text-xs text-slate-500 mt-1">Last checked: {new Date(guard.sia_checked_at).toLocaleString()}</p>
          )}
        </div>
      )}

      {hasLicenceImages && (
        <button
          onClick={onViewLicence}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-image-line w-4 h-4 flex items-center justify-center"></i>
          View Licence Images
        </button>
      )}
    </>
  );
}