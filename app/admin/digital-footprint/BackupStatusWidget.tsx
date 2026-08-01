'use client';

import { useState } from 'react';

interface BackupInfo {
  id: string | null;
  backup_status: string | null;
  backup_type: string | null;
  last_backup_at: string | null;
  recovery_test_status: string | null;
}

interface BackupStatusWidgetProps {
  backup: BackupInfo | null;
  onClick: () => void;
}

export default function BackupStatusWidget({ backup, onClick }: BackupStatusWidgetProps) {
  if (!backup) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-600 bg-[#0a1628] border border-[#1a2b4a] hover:border-slate-500/30 hover:text-slate-400 transition-all cursor-pointer whitespace-nowrap"
      >
        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-database-2-line text-[9px]"></i></div>
        Awaiting data
      </button>
    );
  }

  const now = Date.now();
  const backupTime = backup.last_backup_at ? new Date(backup.last_backup_at).getTime() : 0;
  const hoursSinceBackup = backup.last_backup_at ? (now - backupTime) / 3600000 : Infinity;
  const isStale = hoursSinceBackup > 24;
  const isFailed = backup.backup_status === 'failed';

  const badgeCls = isFailed
    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300'
    : isStale
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300';

  const icon = isFailed
    ? 'ri-close-circle-line'
    : isStale
      ? 'ri-error-warning-line'
      : 'ri-check-double-line';

  const statusLabel = isFailed
    ? 'Backup failed'
    : isStale
      ? 'Stale'
      : 'OK';

  const timeLabel = backup.last_backup_at
    ? hoursSinceBackup < 1
      ? 'just now'
      : hoursSinceBackup < 24
        ? Math.floor(hoursSinceBackup) + 'h ago'
        : Math.floor(hoursSinceBackup / 24) + 'd ago'
    : '';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap border ${badgeCls}`}
    >
      <div className="w-3 h-3 flex items-center justify-center"><i className={icon + ' text-[9px]'}></i></div>
      {statusLabel}
      {timeLabel && (
        <span className="text-[9px] opacity-60">({timeLabel})</span>
      )}
    </button>
  );
}