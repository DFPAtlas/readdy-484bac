'use client';

interface PlanChangeRecord {
  id: number;
  user_id: string;
  old_plan_slug: string | null;
  new_plan_slug: string;
  old_plan_name: string | null;
  new_plan_name: string;
  account_type: string;
  changed_by: string;
  change_source: string;
  proration_applied: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  metadata: any;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

interface Props {
  record: PlanChangeRecord;
  user: UserInfo | undefined;
  onClose: () => void;
}

function formatMetaValue(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const METADATA_LABELS: Record<string, string> = {
  stripe_event_id: 'Stripe Event ID',
  stripe_event: 'Stripe Event',
  stripe_subscription_id: 'Stripe Subscription ID',
  promotion: 'Promotion',
  promo_code: 'Promo Code',
  promo_tier: 'Promo Tier',
  fee_adjustment: 'Fee Adjustment',
  old_price: 'Old Price',
  new_price: 'New Price',
  old_interval: 'Old Interval',
  new_interval: 'New Interval',
  reason: 'Reason',
  initiated_by: 'Initiated By',
  ip_address: 'IP Address',
  user_agent: 'User Agent',
};

export default function PlanChangeDetailModal({ record, user, onClose }: Props) {
  const metaEntries = record.metadata && typeof record.metadata === 'object'
    ? Object.entries(record.metadata)
    : [];

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#111d35] border border-[#1e2d4a] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4a] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-base font-semibold text-white">Plan Change Detail</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 block mb-1">Record ID</span>
              <span className="text-sm text-white font-mono">#{record.id}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Date</span>
              <span className="text-sm text-white">{formatDate(record.created_at)}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Account Type</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                record.account_type === 'client' ? 'bg-teal-500/10 text-teal-400 border-teal-400/20' : 'bg-blue-500/10 text-blue-400 border-blue-400/20'
              }`}>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={record.account_type === 'client' ? 'ri-building-line' : 'ri-shield-user-line'}></i>
                </div>
                {record.account_type === 'client' ? 'Client' : 'Guard'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Prorated</span>
              <span className="text-sm text-white">{record.proration_applied ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Changed By</span>
              <span className="text-sm text-white">{record.changed_by || 'System'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Source</span>
              <span className="text-sm text-white capitalize">{record.change_source}</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-slate-500 block mb-1">Stripe Subscription ID</span>
              <span className="text-sm text-white font-mono break-all">{record.stripe_subscription_id || '—'}</span>
            </div>
          </div>

          <div className="bg-[#0d1a30] border border-[#1e2d4a] rounded-xl p-4">
            <span className="text-xs text-slate-500 block mb-3">Plan Change</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400">{record.old_plan_name || 'None (New Signup)'}</span>
              <i className="ri-arrow-right-line text-slate-600"></i>
              <span className="text-white font-medium">{record.new_plan_name}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-600 font-mono">{record.old_plan_slug || '—'}</span>
              <i className="ri-arrow-right-line text-slate-700 text-xs"></i>
              <span className="text-xs text-slate-500 font-mono">{record.new_plan_slug}</span>
            </div>
          </div>

          {user && (
            <div className="bg-[#0d1a30] border border-[#1e2d4a] rounded-xl p-4">
              <span className="text-xs text-slate-500 block mb-3">User</span>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-600 block">Name</span>
                  <span className="text-sm text-white">{user.full_name || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-600 block">Email</span>
                  <span className="text-sm text-white">{user.email || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-600 block">User ID</span>
                  <span className="text-sm text-white font-mono">{record.user_id}</span>
                </div>
              </div>
            </div>
          )}

          {metaEntries.length > 0 && (
            <div className="bg-[#0d1a30] border border-[#1e2d4a] rounded-xl p-4">
              <span className="text-xs text-slate-500 block mb-3">Metadata</span>
              <div className="divide-y divide-[#1e2d4a]">
                {metaEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                    <span className="text-xs text-slate-400">{METADATA_LABELS[key] || key}</span>
                    <span className="text-xs text-white font-mono max-w-[60%] text-right break-all">{formatMetaValue(key, value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metaEntries.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-600">No additional metadata available</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#111d35] border-t border-[#1e2d4a] px-6 py-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}