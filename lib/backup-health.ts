export interface BackupRecord {
  status: string;
  last_backup_at: string | null;
  last_restore_test_at: string | null;
  retention_days: number | null;
}

export interface BackupAssessment {
  status: 'healthy' | 'warning' | 'critical';
  label: string;
  reason: string;
}

export function assessBackup(record: BackupRecord, now = Date.now()): BackupAssessment {
  const backupAt = record.last_backup_at ? Date.parse(record.last_backup_at) : NaN;
  if (!Number.isFinite(backupAt) || backupAt > now) {
    return {
      status: record.status === 'critical' ? 'critical' : 'warning',
      label: record.status === 'critical' ? 'Critical' : 'Needs Check',
      reason: 'No valid last-backup timestamp is recorded.',
    };
  }
  const retention = record.retention_days;
  if (retention === null || !Number.isFinite(retention) || retention <= 0) {
    return {
      status: record.status === 'critical' ? 'critical' : 'warning',
      label: record.status === 'critical' ? 'Critical' : 'Needs Check',
      reason: 'No valid retention window is recorded.',
    };
  }
  if (now - backupAt > retention * 86400000) {
    return {
      status: 'critical',
      label: 'Stale Record',
      reason: 'The last recorded backup is older than the recorded retention window.',
    };
  }
  if (record.status === 'critical') {
    return { status: 'critical', label: 'Critical', reason: 'Backup tracking reports a critical issue.' };
  }
  const restoredAt = record.last_restore_test_at ? Date.parse(record.last_restore_test_at) : NaN;
  if (!Number.isFinite(restoredAt) || restoredAt > now) {
    return {
      status: 'warning',
      label: 'Needs Check',
      reason: 'No valid restore-test timestamp is recorded.',
    };
  }
  if (record.status !== 'healthy') {
    return { status: 'warning', label: 'Needs Check', reason: 'Backup tracking requires review.' };
  }
  return {
    status: 'healthy',
    label: 'Current Record',
    reason: 'Recorded backup is within the retention window; provider verification is still required.',
  };
}