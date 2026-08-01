'use client';

import DocumentImage from '@/components/DocumentImage';
import { GuardVerification } from './types';

interface DocumentsReviewPanelProps {
  guard: GuardVerification;
  checked: boolean;
  onToggle: () => void;
}

export default function DocumentsReviewPanel({ guard, checked, onToggle }: DocumentsReviewPanelProps) {
  const hasDrivingLicence = guard.driving_licence_front_url || guard.driving_licence_back_url;
  const hasPoA = guard.proof_of_address_url;
  const hasAny = hasDrivingLicence || hasPoA;

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
          <i className="ri-file-list-3-line"></i>
          Identity Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Driving Licence Front</p>
            <p className={`font-semibold ${guard.driving_licence_front_url ? 'text-emerald-400' : 'text-red-400'}`}>
              {guard.driving_licence_front_url ? 'Uploaded' : 'Missing'}
            </p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Driving Licence Back</p>
            <p className={`font-semibold ${guard.driving_licence_back_url ? 'text-emerald-400' : 'text-red-400'}`}>
              {guard.driving_licence_back_url ? 'Uploaded' : 'Missing'}
            </p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Proof of Address</p>
            <p className={`font-semibold ${guard.proof_of_address_url ? 'text-emerald-400' : 'text-red-400'}`}>
              {guard.proof_of_address_url ? 'Uploaded' : 'Missing'}
            </p>
          </div>
        </div>
        {guard.driving_licence_uploaded_at && (
          <p className="text-xs text-amber-400 mt-3">
            <i className="ri-time-line mr-1"></i>
            Driving licence uploaded: {new Date(guard.driving_licence_uploaded_at).toLocaleString('en-GB')}
          </p>
        )}
        {guard.proof_of_address_uploaded_at && (
          <p className="text-xs text-amber-400 mt-1">
            <i className="ri-time-line mr-1"></i>
            Proof of address uploaded: {new Date(guard.proof_of_address_uploaded_at).toLocaleString('en-GB')}
          </p>
        )}
      </div>

      {hasAny ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Document Review</h3>
            <button
              onClick={onToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                checked
                  ? 'bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/30'
                  : 'bg-[#1a2b4a] text-slate-400 border-2 border-[#1a2b4a] hover:bg-[#243452] hover:text-slate-300'
              }`}
            >
              {checked ? '✓ Documents Verified' : 'Confirm Documents'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {guard.driving_licence_front_url && (
              <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#111d35] border-b border-[#1a2b4a] flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center bg-amber-500/10 rounded-lg">
                    <i className="ri-car-line text-amber-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Driving Licence Front</p>
                    <p className="text-xs text-slate-500">Primary identification</p>
                  </div>
                </div>
                <div className="p-4">
                  <DocumentImage path={guard.driving_licence_front_url} label="Driving Licence Front" className="rounded-lg" />
                </div>
              </div>
            )}

            {guard.driving_licence_back_url && (
              <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#111d35] border-b border-[#1a2b4a] flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center bg-amber-500/10 rounded-lg">
                    <i className="ri-car-line text-amber-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Driving Licence Back</p>
                    <p className="text-xs text-slate-500">Secondary identification</p>
                  </div>
                </div>
                <div className="p-4">
                  <DocumentImage path={guard.driving_licence_back_url} label="Driving Licence Back" className="rounded-lg" />
                </div>
              </div>
            )}

            {guard.proof_of_address_url && (
              <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#111d35] border-b border-[#1a2b4a] flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 rounded-lg">
                    <i className="ri-home-line text-blue-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Proof of Address</p>
                    <p className="text-xs text-slate-500">Address verification</p>
                  </div>
                </div>
                <div className="p-4">
                  <DocumentImage path={guard.proof_of_address_url} label="Proof of Address" className="rounded-lg" />
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
                  <li>• Verify the driving licence is current and not expired</li>
                  <li>• Confirm the name on the driving licence matches the guard&apos;s profile</li>
                  <li>• Check the proof of address is recent (within last 3 months)</li>
                  <li>• Ensure the address on POA matches the address provided</li>
                  <li>• Click any image to enlarge for closer inspection</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-file-list-3-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h3 className="text-lg font-semibold text-red-400 mb-2">No Documents Uploaded</h3>
          <p className="text-red-400/80 text-sm mb-4">This guard has not uploaded their driving licence or proof of address.</p>
          <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1a2b4a] inline-block text-left">
            <p className="text-sm font-medium text-white mb-2">Recommended Action:</p>
            <p className="text-sm text-slate-400">Reject the application and ask the guard to upload their driving licence (front and back) and a recent proof of address before reapplying.</p>
          </div>
        </div>
      )}
    </div>
  );
}