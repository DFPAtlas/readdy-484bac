'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface BackupInfo {
  id: string | null;
  app_slug?: string;
  backup_type: string | null;
  backup_status: string | null;
  backup_location: string | null;
  last_backup_at: string | null;
  recovery_test_status: string | null;
  last_recovery_test_at: string | null;
  recovery_notes: string | null;
}

interface BackupDetailModalProps {
  projectName: string;
  backup: BackupInfo | null;
  onClose: () => void;
  onSaved: () => void;
  isSuperAdmin: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function BackupDetailModal({ projectName, backup, onClose, onSaved, isSuperAdmin, showToast }: BackupDetailModalProps) {
  const admin = useAdminAuth();
  const [form, setForm] = useState({
    backupType: '',
    backupStatus: '',
    backupLocation: '',
    lastBackupAt: '',
    recoveryTestStatus: '',
    lastRecoveryTestAt: '',
    recoveryNotes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (backup) {
      setForm({
        backupType: backup.backup_type || 'full',
        backupStatus: backup.backup_status || 'pending',
        backupLocation: backup.backup_location || '',
        lastBackupAt: backup.last_backup_at ? backup.last_backup_at.slice(0, 16) : '',
        recoveryTestStatus: backup.recovery_test_status || 'untested',
        lastRecoveryTestAt: backup.last_recovery_test_at ? backup.last_recovery_test_at.slice(0, 16) : '',
        recoveryNotes: backup.recovery_notes || '',
      });
    }
  }, [backup]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      showToast('Only super-admins can edit backup data', 'error');
      return;
    }

    setSaving(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;

      const payload = {
        app_slug: projectName.toLowerCase(),
        backup_type: form.backupType || 'full',
        backup_status: form.backupStatus || 'pending',
        backup_location: form.backupLocation || null,
        last_backup_at: form.lastBackupAt ? new Date(form.lastBackupAt).toISOString() : null,
        recovery_test_status: form.recoveryTestStatus || 'untested',
        last_recovery_test_at: form.lastRecoveryTestAt ? new Date(form.lastRecoveryTestAt).toISOString() : null,
        recovery_notes: form.recoveryNotes || null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (backup?.id) {
        result = await supabase
          .from('digital_footprint_backups')
          .update(payload)
          .eq('id', backup.id)
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('digital_footprint_backups')
          .insert({ ...payload, id: undefined })
          .select()
          .maybeSingle();
      }

      if (result.error) {
        showToast('Failed to save: ' + result.error.message, 'error');
        setSaving(false);
        return;
      }

      await supabase.from('admin_activity_log').insert({
        admin_username: adminUsername,
        admin_name: adminName,
        action_type: backup?.id ? 'update_backup_data' : 'create_backup_data',
        action_description: backup?.id
          ? `Updated backup data for ${projectName}`
          : `Created backup data for ${projectName}`,
        target_type: 'digital_footprint_backups',
        target_name: projectName,
        metadata: {
          project_name: projectName,
          changes: payload,
          previous: backup,
        },
      });

      showToast('Backup data saved', 'success');
      onSaved();
    } catch (err) {
      console.error('Save error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setSaving(false);
    }
  };

  const now = Date.now();
  const backupTime = backup?.last_backup_at ? new Date(backup.last_backup_at).getTime() : 0;
  const hoursSinceBackup = backup?.last_backup_at ? (now - backupTime) / 3600000 : Infinity;
  const isStale = hoursSinceBackup > 24;
  const isFailed = backup?.backup_status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <i className="ri-database-2-line"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{projectName}</h3>
              <p className="text-[10px] text-slate-500">Backup &amp; recovery tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer">
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!backup && (
            <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                <i className="ri-information-line text-sm"></i>
              </div>
              <p className="text-xs text-slate-400">
                Awaiting backup data. This record is ready for n8n backup workflows to update.
              </p>
            </div>
          )}

          {isFailed && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-red-400 mt-0.5">
                <i className="ri-close-circle-line text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-red-400 font-semibold">Backup Failed</p>
                {backup?.last_backup_at && (
                  <p className="text-[10px] text-red-400/50 mt-1">
                    Last attempt: {new Date(backup.last_backup_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {isStale && !isFailed && backup && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-amber-400 mt-0.5">
                <i className="ri-error-warning-line text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-amber-400 font-semibold">Backup Stale</p>
                <p className="text-[11px] text-amber-400/70 mt-1">
                  Last backup was {Math.floor(hoursSinceBackup)} hours ago
                </p>
              </div>
            </div>
          )}

          {backup && backup.backup_status === 'success' && !isStale && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-emerald-400">
                <i className="ri-check-double-line text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-semibold">Backup Healthy</p>
                {backup?.last_backup_at && (
                  <p className="text-[10px] text-emerald-400/50 mt-1">
                    Last backup: {new Date(backup.last_backup_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Backup config
              </span>
              {!isSuperAdmin && (
                <span className="text-[9px] text-slate-600 italic ml-auto">Read-only</span>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Backup Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'full', label: 'Full' },
                      { value: 'incremental', label: 'Incremental' },
                      { value: 'code_only', label: 'Code Only' },
                      { value: 'db_only', label: 'DB Only' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateField('backupType', opt.value)}
                        disabled={!isSuperAdmin}
                        className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                          form.backupType === opt.value
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-emerald-500/30 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Backup Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'pending', label: 'Pending' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'success', label: 'Success' },
                      { value: 'failed', label: 'Failed' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateField('backupStatus', opt.value)}
                        disabled={!isSuperAdmin}
                        className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                          form.backupStatus === opt.value
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-emerald-500/30 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-folder-shield-line text-[11px]"></i></div>
                  Backup Location
                </label>
                {isSuperAdmin ? (
                  <input
                    type="text"
                    value={form.backupLocation}
                    onChange={(e) => updateField('backupLocation', e.target.value)}
                    placeholder="s3://bucket/backups/app-name"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
                  />
                ) : (
                  <p className="text-sm text-slate-600 font-mono bg-[#0a1628] px-3 py-2 rounded-xl border border-[#1a2b4a]">
                    {form.backupLocation ? '\u2022\u2022\u2022 restricted' : '\u2014'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Backup At</label>
                <input
                  type="datetime-local"
                  value={form.lastBackupAt}
                  onChange={(e) => updateField('lastBackupAt', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div className="border-t border-[#1a2b4a] pt-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Recovery Testing</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Recovery Test Status</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: 'untested', label: 'Untested' },
                        { value: 'passed', label: 'Passed' },
                        { value: 'failed', label: 'Failed' },
                        { value: 'in_progress', label: 'In Progress' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateField('recoveryTestStatus', opt.value)}
                          disabled={!isSuperAdmin}
                          className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                            form.recoveryTestStatus === opt.value
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-emerald-500/30 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Recovery Test At</label>
                    <input
                      type="datetime-local"
                      value={form.lastRecoveryTestAt}
                      onChange={(e) => updateField('lastRecoveryTestAt', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
                      disabled={!isSuperAdmin}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Recovery Notes</label>
                  <textarea
                    value={form.recoveryNotes}
                    onChange={(e) => updateField('recoveryNotes', e.target.value)}
                    placeholder="Notes about recovery test results..."
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 resize-none"
                    rows={2}
                    maxLength={500}
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-[9px] text-slate-600 mt-1 text-right">{form.recoveryNotes.length}/500</p>
                </div>
              </div>
            </div>
          </div>

          {!isSuperAdmin && backup && (
            <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Latest snapshot</p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-600">Type: </span>
                  <span className="text-slate-300 capitalize">{backup.backup_type || '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Status: </span>
                  <span className="text-slate-300 capitalize">{backup.backup_status || '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Recovery Test: </span>
                  <span className="text-slate-300 capitalize">{backup.recovery_test_status || '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Location: </span>
                  <span className="text-slate-500 font-mono text-[10px]">{'\u2022\u2022\u2022 restricted'}</span>
                </div>
                {backup.last_backup_at && (
                  <div className="col-span-2">
                    <span className="text-slate-600">Last Backup: </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(backup.last_backup_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-[#1a2b4a] gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
          {isSuperAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-900/50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                  Saving...
                </>
              ) : (
                <>
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                  Save
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}