'use client';

import { BackupComplianceData } from './SecuritySOCClient';

interface Props {
  backupComplianceData: BackupComplianceData | null;
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

export default function BackupCompliancePanel({ backupComplianceData }: Props) {
  const d = backupComplianceData;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-cyan-500/10 rounded-lg">
            <i className="ri-archive-line text-cyan-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Backup & Recovery</h2>
        </div>
        {d && d.backups.length > 0 ? (
          <div className="space-y-2">
            {d.backups.map((b) => {
              const status = b.status || 'warning';
              const colors = status === 'healthy' ? { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' } : status === 'warning' ? { border: 'border-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-400' } : { border: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' };
              return (
                <div key={b.backup_type} className={`bg-[#0a1628] rounded-lg border p-4 ${colors.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-200">{b.backup_type}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                      {status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Needs Check' : 'Critical'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500">Last Backup: <span className="text-slate-400">{b.last_backup_at ? timeAgo(b.last_backup_at) : 'Never'}</span></span>
                    <span className="text-slate-500">Last Restore: <span className="text-slate-400">{b.last_restore_test_at ? timeAgo(b.last_restore_test_at) : 'Never'}</span></span>
                    <span className="text-slate-500">Retention: <span className="text-slate-400">{b.retention_days ? `${b.retention_days} days` : '—'}</span></span>
                    <span className="text-slate-500">Notes: <span className="text-slate-400">{b.notes || '—'}</span></span>
                  </div>
                </div>
              );
            })}
            {d.backups.some(b => b.status === 'warning') && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <i className="ri-alert-line text-amber-400 text-sm"></i>
                <p className="text-xs text-amber-300">Some backups need attention — check restore tests</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <i className="ri-archive-line text-3xl mb-2"></i>
            <p className="text-sm">Backup data unavailable</p>
            <p className="text-xs text-slate-600 mt-1">Backup tracking not configured</p>
          </div>
        )}
      </div>

      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-blue-500/10 rounded-lg">
            <i className="ri-scales-3-line text-blue-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Compliance Centre</h2>
        </div>
        {d && d.compliance.length > 0 ? (
          <div className="space-y-1.5">
            {d.compliance.map((item) => {
              const status = item.status || 'missing';
              const colors = status === 'complete' ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'ri-check-fill' } : status === 'review' ? { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'ri-time-fill' } : { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'ri-close-fill' };
              return (
                <div key={item.key} className="flex items-center justify-between bg-[#0a1628] rounded-lg px-4 py-2.5 border border-[#1a2b4a]">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 flex items-center justify-center rounded ${colors.bg}`}>
                      <i className={`${item.key === 'gdpr' ? 'ri-shield-check-line' : item.key === 'ico' ? 'ri-government-line' : item.key === 'privacy_policy' ? 'ri-file-text-line' : item.key === 'terms' ? 'ri-file-list-2-line' : item.key === 'cookie_policy' ? 'ri-shield-flash-line' : item.key === 'data_retention' ? 'ri-archive-line' : item.key === 'encryption' ? 'ri-lock-password-line' : item.key === 'audit_logging' ? 'ri-survey-line' : item.key === 'sia_compliance' ? 'ri-police-car-line' : 'ri-delete-back-line'} text-xs ${colors.text}`}></i>
                    </div>
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                    <i className={`${colors.icon} text-[10px] mr-0.5`}></i>
                    {status === 'complete' ? 'Complete' : status === 'review' ? 'Needs Review' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <i className="ri-scales-3-line text-3xl mb-2"></i>
            <p className="text-sm">Compliance data unavailable</p>
            <p className="text-xs text-slate-600 mt-1">Compliance tracking not configured</p>
          </div>
        )}
      </div>
    </div>
  );
}