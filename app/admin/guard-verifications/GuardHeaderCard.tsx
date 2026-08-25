'use client';

import { GuardVerification, getSiaCheckStatusBadge } from './types';

interface GuardHeaderCardProps {
  guard: GuardVerification;
  hasLicenceImages: boolean;
}

export default function GuardHeaderCard({ guard, hasLicenceImages }: GuardHeaderCardProps) {
  const siaBadge = getSiaCheckStatusBadge(guard.sia_check_status, guard.verification_status);

  return (
    <div className="bg-gradient-to-r from-[#111d35] to-[#162036] rounded-xl p-6 border border-[#1a2b4a]">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[#0a1628] flex-shrink-0 border-4 border-[#1a2b4a] shadow-lg">
          {guard.profile_image_url ? (
            <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-sky-500/20">
              <i className="ri-user-line text-3xl text-teal-400 w-8 h-8 flex items-center justify-center"></i>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white mb-1">{guard.full_name}</h3>
          <p className="text-slate-400">{guard.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30">
              SIA: {guard.sia_licence_number || 'Not provided'}
            </span>
            {guard.sia_expiry_date && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/30">
                Expires: {new Date(guard.sia_expiry_date).toLocaleDateString()}
              </span>
            )}
            {hasLicenceImages && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                <i className="ri-image-line mr-1 w-3 h-3 inline-flex items-center justify-center"></i>
                Images Uploaded
              </span>
            )}
            {guard.city && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/30">
                <i className="ri-map-pin-line mr-1 w-3 h-3 inline-flex items-center justify-center"></i>
                {guard.city}
              </span>
            )}
            {guard.has_transport && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/30">
                <i className="ri-car-line mr-1 w-3 h-3 inline-flex items-center justify-center"></i>
                Has Transport
              </span>
            )}
            {guard.years_experience != null && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30">
                {guard.years_experience} yrs exp
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ${siaBadge.color} inline-flex items-center gap-1.5`}>
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={`${siaBadge.icon} text-xs`}></i>
              </div>
              {siaBadge.label}
            </span>
            {guard.sia_confidence_score != null && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/30">
                Confidence: {guard.sia_confidence_score}%
              </span>
            )}
            {guard.sia_mismatch_reason && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/30 cursor-help" title={guard.sia_mismatch_reason}>
                Mismatch
              </span>
            )}
            {guard.plan_name && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
                {guard.plan_name}
              </span>
            )}
            {guard.subscription_status && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ${
                guard.subscription_status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                  : guard.subscription_status === 'trialing'
                  ? 'bg-blue-500/10 text-blue-400 ring-blue-500/30'
                  : guard.subscription_status === 'past_due'
                  ? 'bg-red-500/10 text-red-400 ring-red-500/30'
                  : 'bg-slate-500/10 text-slate-400 ring-slate-500/30'
              }`}>
                <i className={`mr-1 w-3 h-3 inline-flex items-center justify-center ${
                  guard.subscription_status === 'active' ? 'ri-checkbox-circle-fill' :
                  guard.subscription_status === 'trialing' ? 'ri-timer-flash-fill' :
                  guard.subscription_status === 'past_due' ? 'ri-error-warning-fill' :
                  'ri-information-fill'
                }`}></i>
                {guard.subscription_status === 'active' ? 'Active' :
                 guard.subscription_status === 'trialing' ? 'Trial' :
                 guard.subscription_status === 'past_due' ? 'Past Due' :
                 guard.subscription_status}
              </span>
            )}
            {!guard.plan_name && !guard.subscription_status && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/30">
                No subscription
              </span>
            )}
            {guard.founding_badge && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30">
                <i className="ri-vip-crown-line mr-1 w-3 h-3 inline-flex items-center justify-center"></i>
                Founding Guard
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500">Registered</p>
          <p className="text-sm font-medium text-slate-300">{new Date(guard.created_at).toLocaleDateString()}</p>
          {guard.signup_number != null && (
            <p className="text-xs text-slate-500 mt-1">Signup #{guard.signup_number}</p>
          )}
        </div>
      </div>
    </div>
  );
}