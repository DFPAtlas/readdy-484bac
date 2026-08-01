'use client';

import SIALicenceImage from '@/components/SIALicenceImage';
import { GuardVerification } from './types';

interface LicenceReviewPanelProps {
  guard: GuardVerification;
  hasLicenceImages: boolean;
  checked: boolean;
  onToggle: () => void;
}

export default function LicenceReviewPanel({ guard, hasLicenceImages, checked, onToggle }: LicenceReviewPanelProps) {
  const isExpired = guard.sia_expiry_date && new Date(guard.sia_expiry_date) < new Date();

  return (
    <div className="space-y-6">
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
          <i className="ri-shield-check-line"></i>
          SIA Licence Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Licence Number</p>
            <p className="font-mono font-semibold text-white text-lg">{guard.sia_licence_number || '—'}</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Cardholder Name</p>
            <p className="font-semibold text-white">{guard.license_cardholder_name || '—'}</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Expiry Date</p>
            <p className={`font-semibold ${isExpired ? 'text-red-400' : 'text-white'}`}>
              {guard.sia_expiry_date ? new Date(guard.sia_expiry_date).toLocaleDateString() : '—'}
              {isExpired && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full">EXPIRED</span>
              )}
            </p>
          </div>
        </div>
        {guard.sia_licence_uploaded_at && (
          <p className="text-xs text-purple-400 mt-3">
            <i className="ri-time-line mr-1"></i>
            Images uploaded: {new Date(guard.sia_licence_uploaded_at).toLocaleString('en-GB')}
          </p>
        )}
      </div>

      {hasLicenceImages ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Licence Image Review</h3>
            <button
              onClick={onToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                checked
                  ? 'bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/30'
                  : 'bg-[#1a2b4a] text-slate-400 border-2 border-[#1a2b4a] hover:bg-[#243452] hover:text-slate-300'
              }`}
            >
              {checked ? '✓ Licence Verified' : 'Confirm Licence'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {guard.sia_licence_front_url && (
              <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#111d35] border-b border-[#1a2b4a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 rounded-lg">
                      <i className="ri-id-card-line text-blue-400"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Front of Licence</p>
                      <p className="text-xs text-slate-500">Primary identification</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full">Required</span>
                </div>
                <div className="p-4">
                  <SIALicenceImage path={guard.sia_licence_front_url} label="" className="rounded-lg" />
                </div>
              </div>
            )}

            {guard.sia_licence_back_url && (
              <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#111d35] border-b border-[#1a2b4a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-purple-500/10 rounded-lg">
                      <i className="ri-id-card-line text-purple-400"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Back of Licence</p>
                      <p className="text-xs text-slate-500">Secondary verification</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full">Required</span>
                </div>
                <div className="p-4">
                  <SIALicenceImage path={guard.sia_licence_back_url} label="" className="rounded-lg" />
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <i className="ri-information-line text-amber-400 text-xl w-5 h-5 flex items-center justify-center flex-shrink-0"></i>
              <div>
                <p className="text-sm font-medium text-amber-400">Review Guidelines</p>
                <ul className="text-sm text-amber-400/80 mt-1 space-y-1">
                  <li>• Verify the licence number matches the SIA database</li>
                  <li>• Check the photo matches the guard&apos;s profile image</li>
                  <li>• Confirm the expiry date is valid and not expired</li>
                  <li>• Ensure the cardholder name matches the applicant&apos;s name</li>
                  <li>• Click any image to enlarge for closer inspection</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-image-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h3 className="text-lg font-semibold text-red-400 mb-2">No Licence Images</h3>
          <p className="text-red-400/80 text-sm mb-4">This guard has not uploaded any SIA licence images.</p>
          <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1a2b4a] inline-block text-left">
            <p className="text-sm font-medium text-white mb-2">Recommended Action:</p>
            <p className="text-sm text-slate-400">Reject the application and ask the guard to upload clear photos of both sides of their SIA licence before reapplying.</p>
          </div>
        </div>
      )}
    </div>
  );
}