'use client';

import { GuardVerification } from './types';

interface GuardCardProps {
  guard: GuardVerification;
  onReview: () => void;
}

export default function GuardCard({ guard, onReview }: GuardCardProps) {
  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6 hover:border-teal-500/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a2b4a] flex-shrink-0">
            {guard.profile_image_url ? (
              <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-sky-500/20">
                <i className="ri-user-line text-2xl text-teal-400 w-6 h-6 flex items-center justify-center"></i>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">{guard.full_name}</h3>
            <div className="space-y-1 text-sm text-slate-400">
              <p className="flex items-center gap-2">
                <i className="ri-mail-line w-4 h-4 flex items-center justify-center"></i>
                {guard.email}
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-phone-line w-4 h-4 flex items-center justify-center"></i>
                {guard.phone || 'Not provided'}
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center"></i>
                SIA: {guard.sia_licence_number || 'Not provided'}
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
                Registered: {new Date(guard.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {guard.hourly_rate && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                  £{guard.hourly_rate}/hr
                </span>
              )}
              {guard.years_experience != null && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">
                  {guard.years_experience} years exp
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onReview}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-500 transition-colors whitespace-nowrap"
        >
          Review Application
        </button>
      </div>
    </div>
  );
}