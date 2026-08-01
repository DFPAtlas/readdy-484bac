'use client';

import { GuardVerification, formatDate } from './types';
import VerificationSection from './VerificationSection';

interface AccountTabProps {
  guard: GuardVerification;
  checked: boolean;
  onToggle: () => void;
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#1a2b4a] last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium text-right ${highlight ? 'text-teal-400' : 'text-slate-200'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5">
      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center">
          <i className={`${icon} text-teal-400 text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function AccountTab({ guard, checked, onToggle }: AccountTabProps) {
  const formatMoney = (val: number | null | undefined) => {
    if (val == null) return '—';
    return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatArray = (arr: string[] | null | undefined) => {
    if (!arr || arr.length === 0) return '—';
    return arr.map(s => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
  };

  return (
    <div className="space-y-4">
      <VerificationSection
        icon="ri-settings-3-line"
        iconColor="bg-slate-500/10"
        iconTextColor="text-slate-400"
        title="Platform & Account Review"
        description="Stripe, subscription, stats, and admin metadata"
        checked={checked}
        onToggle={onToggle}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Location & Transport */}
          <SectionCard title="Location & Transport" icon="ri-map-pin-line">
            <InfoRow label="City" value={guard.city} />
            <InfoRow label="Postcode" value={guard.postcode} />
            <InfoRow label="Location" value={guard.location} />
            <InfoRow label="Has Transport" value={guard.has_transport ? 'Yes' : 'No'} highlight={guard.has_transport === true} />
            <InfoRow label="Willing to Travel" value={guard.willing_to_travel ? 'Yes' : 'No'} />
            <InfoRow label="Max Distance" value={guard.max_distance_miles != null ? `${guard.max_distance_miles} miles` : '—'} />
          </SectionCard>

          {/* SIA Licence Types */}
          <SectionCard title="SIA Details" icon="ri-shield-check-line">
            <InfoRow label="Licence Types" value={formatArray(guard.licence_types)} />
            <InfoRow label="SIA Type" value={guard.sia_licence_type} />
            <InfoRow label="Scraped Type" value={guard.sia_scraped_licence_type} />
            <InfoRow label="Scraped Expiry" value={guard.sia_scraped_expiry_date} />
            <InfoRow label="SIA Verified" value={guard.sia_verified ? 'Yes' : 'No'} highlight={guard.sia_verified === true} />
            <InfoRow label="SIA Verified At" value={formatDate(guard.sia_verified_at)} />
          </SectionCard>

          {/* Stripe & Connect */}
          <SectionCard title="Stripe & Connect" icon="ri-bank-card-line">
            <InfoRow label="Account ID" value={guard.stripe_account_id ? `${guard.stripe_account_id.slice(0, 12)}...` : '—'} />
            <InfoRow label="Connect Status" value={guard.stripe_connect_status} highlight={guard.stripe_connect_status === 'active'} />
            <InfoRow label="Connect Reason" value={guard.stripe_connect_restricted_reason} />
            <InfoRow label="Onboarded" value={formatDate(guard.stripe_connect_onboarded_at)} />
            <InfoRow label="Connect Verified" value={formatDate(guard.stripe_connect_verified_at)} />
          </SectionCard>

          {/* Subscription */}
          <SectionCard title="Subscription" icon="ri-vip-crown-line">
            <InfoRow label="Plan Name" value={guard.plan_name} highlight={!!guard.plan_name} />
            <InfoRow label="Plan Slug" value={guard.plan_slug} />
            <InfoRow label="Sub Plan" value={guard.subscription_plan} />
            <InfoRow label="Sub Status" value={guard.subscription_status} highlight={guard.subscription_status === 'active'} />
          </SectionCard>

          {/* Stats */}
          <SectionCard title="Platform Stats" icon="ri-bar-chart-box-line">
            <InfoRow label="Jobs Completed" value={guard.total_jobs_completed != null ? String(guard.total_jobs_completed) : '—'} highlight={!!guard.total_jobs_completed && guard.total_jobs_completed > 0} />
            <InfoRow label="Total Earnings" value={formatMoney(guard.total_earnings)} highlight={!!guard.total_earnings && guard.total_earnings > 0} />
            <InfoRow label="Rating" value={guard.rating != null ? `${guard.rating.toFixed(1)} / 5` : '—'} />
            <InfoRow label="Reviews" value={guard.total_reviews != null ? String(guard.total_reviews) : '—'} />
          </SectionCard>

          {/* Activity */}
          <SectionCard title="Activity & Access" icon="ri-user-settings-line">
            <InfoRow label="Is Active" value={guard.is_active ? 'Yes' : 'No'} highlight={guard.is_active === true} />
            <InfoRow label="Dashboard Access" value={guard.dashboard_access ? 'Yes' : 'No'} />
            <InfoRow label="Founding Badge" value={guard.founding_badge ? 'Yes' : 'No'} highlight={guard.founding_badge === true} />
            <InfoRow label="Promo Tier" value={guard.promo_tier} />
            <InfoRow label="Signup #" value={guard.signup_number != null ? `#${guard.signup_number}` : '—'} />
            <InfoRow label="Onboarding" value={guard.onboarding_status} />
          </SectionCard>
        </div>

        {/* Application Timeline */}
        <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5 mt-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <i className="ri-time-line text-amber-400 text-sm w-4 h-4 flex items-center justify-center"></i>
            </div>
            Application Timeline
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {guard.created_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Registered</p>
                <p className="text-sm font-medium text-slate-200">{new Date(guard.created_at).toLocaleDateString('en-GB')}</p>
                <p className="text-xs text-slate-500">{new Date(guard.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            {guard.updated_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-sm font-medium text-slate-200">{new Date(guard.updated_at).toLocaleDateString('en-GB')}</p>
                <p className="text-xs text-slate-500">{new Date(guard.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            {guard.verified_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Verified</p>
                <p className="text-sm font-medium text-emerald-400">{new Date(guard.verified_at).toLocaleDateString('en-GB')}</p>
                <p className="text-xs text-slate-500">{new Date(guard.verified_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            {guard.rejected_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-red-500/20">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rejected</p>
                <p className="text-sm font-medium text-red-400">{new Date(guard.rejected_at).toLocaleDateString('en-GB')}</p>
                <p className="text-xs text-slate-500">{new Date(guard.rejected_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            {guard.nudge_sent_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nudge Sent</p>
                <p className="text-sm font-medium text-slate-200">{new Date(guard.nudge_sent_at).toLocaleDateString('en-GB')}</p>
              </div>
            )}
            {guard.sia_checked_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">SIA Checked</p>
                <p className="text-sm font-medium text-slate-200">{new Date(guard.sia_checked_at).toLocaleDateString('en-GB')}</p>
              </div>
            )}
            {guard.sia_verified_at && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-emerald-500/20">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">SIA Verified</p>
                <p className="text-sm font-medium text-emerald-400">{new Date(guard.sia_verified_at).toLocaleDateString('en-GB')}</p>
              </div>
            )}
          </div>
          {guard.rejection_reason && (
            <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-400/80">{guard.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Raw SIA Result */}
        {guard.sia_raw_result_json && (
          <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5 mt-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <i className="ri-file-code-line text-blue-400 text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
              SIA Raw Result JSON
            </h4>
            <pre className="text-xs text-slate-300 bg-[#111d35] rounded-lg p-4 border border-[#1a2b4a] overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {JSON.stringify(guard.sia_raw_result_json, null, 2)}
            </pre>
          </div>
        )}

        {/* SIA Verification Details */}
        {guard.sia_verification_details && (
          <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5 mt-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <i className="ri-shield-flash-line text-purple-400 text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
              SIA Verification Details
            </h4>
            <pre className="text-xs text-slate-300 bg-[#111d35] rounded-lg p-4 border border-[#1a2b4a] overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {JSON.stringify(guard.sia_verification_details, null, 2)}
            </pre>
          </div>
        )}

        {/* Admin IDs */}
        <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5 mt-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-500/10 rounded-lg flex items-center justify-center">
              <i className="ri-fingerprint-line text-slate-400 text-sm w-4 h-4 flex items-center justify-center"></i>
            </div>
            Internal IDs
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-slate-500 uppercase tracking-wider mb-1">Guard ID</p>
              <p className="font-mono text-slate-300 break-all">{guard.id}</p>
            </div>
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-slate-500 uppercase tracking-wider mb-1">User ID</p>
              <p className="font-mono text-slate-300 break-all">{guard.user_id}</p>
            </div>
            {guard.verified_by && (
              <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Verified By</p>
                <p className="font-mono text-slate-300 break-all">{guard.verified_by}</p>
              </div>
            )}
          </div>
        </div>
      </VerificationSection>
    </div>
  );
}