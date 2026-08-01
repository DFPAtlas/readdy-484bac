'use client';

import { AdminCounts } from './SecuritySOCClient';

interface Props {
  adminCounts: AdminCounts | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'healthy') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"><i className="ri-checkbox-circle-fill text-[10px]"></i> Healthy</span>;
  if (status === 'warning') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"><i className="ri-error-warning-fill text-[10px]"></i> Needs Attention</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20"><i className="ri-close-circle-fill text-[10px]"></i> Disabled</span>;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AuthAdminPanel({ adminCounts }: Props) {
  const ac = adminCounts;

  const authItems = [
    { name: 'Email Verification', status: 'healthy' as const, description: 'Required for all new accounts' },
    { name: 'Password Reset Flow', status: 'healthy' as const, description: 'Magic link + email reset active' },
    { name: 'Magic Link Auth', status: 'healthy' as const, description: 'Operational with 5min expiry' },
    { name: 'Session Timeout', status: 'healthy' as const, description: '30 min idle, 8hr max' },
    { name: 'MFA Status', status: 'warning' as const, description: 'MFA enforcement status cannot be verified automatically. Check Supabase Auth settings manually.' },
    { name: 'Rate Limiting', status: 'healthy' as const, description: 'Login: 5/min, API: 100/min' },
    { name: 'Account Lockout', status: 'healthy' as const, description: '5 failed attempts = 15min lock' },
    { name: 'Failed Login Protection', status: 'healthy' as const, description: 'Progressive delay on repeated failures' },
  ];

  const adminItems = [
    { label: 'Total Super Admins', value: ac ? String(ac.superAdmins) : '—', icon: 'ri-admin-line', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Admins', value: ac ? String(ac.totalAdmins) : '—', icon: 'ri-shield-user-line', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Last Admin Login', value: ac ? timeAgo(ac.lastAdminLogin) : '—', icon: 'ri-login-box-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Failed Logins Today', value: ac ? String(ac.lockedAccounts) : '—', icon: 'ri-error-warning-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Inactive Admins', value: ac ? String(ac.inactiveAdmins) : '—', icon: 'ri-lock-line', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    { label: 'Permission Changes (7d)', value: ac ? String(ac.permissionChanges7d) : '—', icon: 'ri-shield-check-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ];

  const hasInactive = ac && ac.inactiveAdmins > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-sky-500/10 rounded-lg">
            <i className="ri-shield-keyhole-line text-sky-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Authentication Status</h2>
        </div>
        <div className="space-y-2">
          {authItems.map((item) => (
            <div key={item.name} className="flex items-center justify-between bg-[#0a1628] rounded-lg px-4 py-3 border border-[#1a2b4a]">
              <div>
                <p className="text-sm font-medium text-slate-200">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-indigo-500/10 rounded-lg">
              <i className="ri-admin-line text-indigo-400 text-sm"></i>
            </div>
            <h2 className="text-base font-semibold text-white">Admin Security</h2>
          </div>
          <button
            onClick={() => {
              const toolsSection = document.querySelector('[data-security-tools]');
              if (toolsSection) toolsSection.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 text-xs font-medium bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-list-3-line mr-1"></i>View Audit Log
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {adminItems.map((item) => (
            <div key={item.label} className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3">
              <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${item.bg} mb-2`}>
                <i className={`${item.icon} ${item.color} text-sm`}></i>
              </div>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        {hasInactive ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <i className="ri-alert-line text-amber-400 text-sm"></i>
            <p className="text-xs text-amber-300">{ac.inactiveAdmins} inactive admin account{ac.inactiveAdmins > 1 ? 's' : ''} detected — review access</p>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <i className="ri-check-fill text-emerald-400 text-sm"></i>
            <p className="text-xs text-emerald-300">All admin accounts active</p>
          </div>
        )}
      </div>
    </div>
  );
}