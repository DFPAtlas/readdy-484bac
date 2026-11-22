'use client';

import type { BackupComplianceData } from './SecuritySOCClient';
import { assessBackup } from '@/lib/backup-health';
import ComplianceRecordRow from './ComplianceRecordRow';

interface Props {
  backupComplianceData: BackupComplianceData | null;
  fetchState: 'idle' | 'loading' | 'error';
  onRetry: () => void;
  onUpdated: () => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Not recorded';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'Invalid timestamp';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const COMPLIANCE_ORDER = ['gdpr', 'ico', 'privacy_policy', 'terms', 'cookie_policy', 'data_retention', 'data_deletion', 'encryption', 'audit_logging', 'sia_compliance'];

function orderCompliance<T extends { key: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = COMPLIANCE_ORDER.indexOf(a.key);
    const bi = COMPLIANCE_ORDER.indexOf(b.key);
    return (ai === -1 ? COMPLIANCE_ORDER.length : ai) - (bi === -1 ? COMPLIANCE_ORDER.length : bi);
  });
}

export default function BackupCompliancePanel({ backupComplianceData, fetchState, onRetry, onUpdated }: Props) {
  const d = backupComplianceData;
  if (fetchState === 'loading') return <p role="status" className="text-slate-400">Loading backup and compliance records…</p>;
  if (fetchState === 'error') return (
    <div role="alert" className="text-amber-300">
      <p>Unable to load backup and compliance records.</p>
      <button onClick={onRetry} className="underline">Retry backup and compliance records</button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-cyan-500/10 rounded-lg">
            <i className="ri-archive-line text-cyan-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Backup & Recovery</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">Tracking records only. Provider backups and restore readiness require independent verification.</p>
        {d && d.backups.length > 0 ? (
          <div className="space-y-2">
            {d.backups.map((b) => {
              const assessment = assessBackup(b);
              const status = assessment.status;
              const colors = status === 'healthy' ? { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' } : status === 'warning' ? { border: 'border-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-400' } : { border: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' };
              return (
                <div key={b.backup_type} className={`bg-[#0a1628] rounded-lg border p-4 ${colors.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-200">{b.backup_type}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                      {assessment.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{assessment.reason}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500">Last Backup: <span className="text-slate-400">{timeAgo(b.last_backup_at)}</span></span>
                    <span className="text-slate-500">Last Restore: <span className="text-slate-400">{timeAgo(b.last_restore_test_at)}</span></span>
                    <span className="text-slate-500">Retention: <span className="text-slate-400">{b.retention_days ? `${b.retention_days} days` : '—'}</span></span>
                    <span className="text-slate-500">Notes: <span className="text-slate-400">{b.notes || '—'}</span></span>
                  </div>
                </div>
              );
            })}
            {d.backups.some(b => assessBackup(b).status !== 'healthy') && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <i className="ri-alert-line text-amber-400 text-sm"></i>
                <p className="text-xs text-amber-300">Backup records need attention. Verify current backups and restore tests.</p>
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
        <p className="text-xs text-slate-400 mb-3">Open any row to review its evidence notes, reference and last reviewed date.</p>
        {d && d.compliance.length > 0 ? (
          <div className="space-y-1.5">
            {orderCompliance(d.compliance).map((item) => (
              <ComplianceRecordRow key={item.key} item={item} onUpdated={onUpdated} />
            ))}
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
