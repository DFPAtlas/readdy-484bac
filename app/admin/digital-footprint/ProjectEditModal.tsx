'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface ProjectRow {
  projectName: string;
  category: string;
  automatedCost: number | null;
  automatedNotes: string | null;
  automatedSupplier: string | null;
  automatedBillingDate: string | null;
  platformCostId: string | null;
  metricId: string | null;
  manualCost: number | null;
  manualNotes: string | null;
  manualBlockers: string | null;
  manualLaunchDate: string | null;
  manualBuildStatus: string | null;
  manualDeployNotes: string | null;
  manualHealth: string | null;
  manualRevenue: number | null;
  isArchived: boolean;
  metricUpdatedAt: string | null;
}

interface ProjectEditModalProps {
  project: ProjectRow;
  onClose: () => void;
  onSaved: () => void;
  isSuperAdmin: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function ProjectEditModal({ project, onClose, onSaved, isSuperAdmin, showToast }: ProjectEditModalProps) {
  const admin = useAdminAuth();
  const [form, setForm] = useState({
    monthlyRunningCost: project.manualCost !== null ? project.manualCost.toString() : '',
    notes: project.manualNotes || '',
    currentBlockers: project.manualBlockers || '',
    launchTargetDate: project.manualLaunchDate || '',
    currentBuildStatus: project.manualBuildStatus || '',
    latestDeploymentNotes: project.manualDeployNotes || '',
    manualHealthStatus: project.manualHealth || '',
    manualRevenueEstimate: project.manualRevenue !== null ? project.manualRevenue.toString() : '',
  });
  const [saving, setSaving] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  const isArchived = project.isArchived;

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      showToast('Only super-admins can edit manual metrics', 'error');
      return;
    }

    if (isArchived) {
      showToast('Archived projects cannot be edited. Restore the project first.', 'error');
      return;
    }

    setSaving(true);

    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;
      const adminUserId = null;

      const payload = {
        project_name: project.projectName,
        monthly_running_cost: form.monthlyRunningCost ? parseFloat(form.monthlyRunningCost) : null,
        notes: form.notes || null,
        current_blockers: form.currentBlockers || null,
        launch_target_date: form.launchTargetDate || null,
        current_build_status: form.currentBuildStatus || null,
        latest_deployment_notes: form.latestDeploymentNotes || null,
        manual_health_status: form.manualHealthStatus || null,
        manual_revenue_estimate: form.manualRevenueEstimate ? parseFloat(form.manualRevenueEstimate) : null,
        is_archived: false,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (project.metricId) {
        result = await supabase
          .from('project_metrics')
          .update(payload)
          .eq('id', project.metricId)
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('project_metrics')
          .insert({ ...payload, id: undefined })
          .select()
          .maybeSingle();
      }

      if (result.error) {
        console.error('Save error:', result.error);
        showToast('Failed to save: ' + result.error.message, 'error');
        setSaving(false);
        return;
      }

      await supabase.from('admin_activity_log').insert({
        admin_username: adminUsername,
        admin_name: adminName,
        action_type: project.metricId ? 'update_project_metrics' : 'create_project_metrics',
        action_description: project.metricId
          ? `Updated manual metrics for ${project.projectName}`
          : `Created manual metrics for ${project.projectName}`,
        target_type: 'project_metrics',
        target_name: project.projectName,
        metadata: {
          project_name: project.projectName,
          changes: payload,
          previous: project.metricId ? {
            monthly_running_cost: project.manualCost,
            notes: project.manualNotes,
            current_blockers: project.manualBlockers,
            launch_target_date: project.manualLaunchDate,
            current_build_status: project.manualBuildStatus,
            latest_deployment_notes: project.manualDeployNotes,
            manual_health_status: project.manualHealth,
            manual_revenue_estimate: project.manualRevenue,
          } : null,
        },
      });

      showToast('Project metrics saved successfully', 'success');
      onSaved();
    } catch (err) {
      console.error('Save exception:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!isSuperAdmin || !project.metricId) return;

    setSaving(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;

      const { error } = await supabase
        .from('project_metrics')
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq('id', project.metricId);

      if (error) {
        showToast('Failed to restore: ' + error.message, 'error');
        setSaving(false);
        return;
      }

      await supabase.from('admin_activity_log').insert({
        admin_username: adminUsername,
        admin_name: adminName,
        action_type: 'restore_project_metrics',
        action_description: `Restored archived project: ${project.projectName}`,
        target_type: 'project_metrics',
        target_name: project.projectName,
        metadata: { project_name: project.projectName },
      });

      showToast('Project restored successfully', 'success');
      setRestoreConfirm(false);
      onSaved();
    } catch (err) {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!isSuperAdmin) return;

    if (project.metricId) {
      setSaving(true);
      try {
        const adminUsername = admin.username || 'admin';
        const adminName = admin.name || adminUsername;

        const { error } = await supabase
          .from('project_metrics')
          .update({ is_archived: true, updated_at: new Date().toISOString() })
          .eq('id', project.metricId);

        if (error) {
          showToast('Failed to archive: ' + error.message, 'error');
          setSaving(false);
          return;
        }

        await supabase.from('admin_activity_log').insert({
          admin_username: adminUsername,
          admin_name: adminName,
          action_type: 'archive_project_metrics',
          action_description: `Archived project: ${project.projectName}`,
          target_type: 'project_metrics',
          target_name: project.projectName,
          metadata: { project_name: project.projectName },
        });

        showToast('Project archived', 'success');
        onSaved();
      } catch (err) {
        showToast('An unexpected error occurred', 'error');
      } finally {
        setSaving(false);
      }
    } else {
      const payload = {
        project_name: project.projectName,
        is_archived: true,
        updated_at: new Date().toISOString(),
      };

      setSaving(true);
      try {
        const { error } = await supabase.from('project_metrics').insert(payload);
        if (error) {
          showToast('Failed to archive: ' + error.message, 'error');
        } else {
          showToast('Project archived', 'success');
          onSaved();
        }
      } catch (err) {
        showToast('An unexpected error occurred', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '\u2014';
    return '\u00A3' + val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <i className={isArchived ? 'ri-archive-line' : 'ri-edit-line'}></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isArchived ? project.projectName + ' (Archived)' : project.projectName}
              </h3>
              <p className="text-[10px] text-slate-500">
                {isArchived ? 'Restore to enable editing' : 'Manual metrics override'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer">
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isArchived && isSuperAdmin && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center text-amber-400">
                  <i className="ri-error-warning-line text-sm"></i>
                </div>
                <p className="text-xs text-amber-400 font-medium">This project is archived. Restore it to enable editing.</p>
              </div>
              {!restoreConfirm ? (
                <button
                  onClick={() => setRestoreConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-all cursor-pointer whitespace-nowrap"
                >
                  Restore
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRestoreConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {saving ? 'Restoring...' : 'Confirm Restore'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a]">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Automated Data (read-only)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-600">Monthly Cost</p>
                <p className="text-sm font-mono text-slate-300 font-semibold">{formatCurrency(project.automatedCost)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">Supplier</p>
                <p className="text-sm text-slate-300">{project.automatedSupplier || '\u2014'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">Category</p>
                <p className="text-sm text-slate-300 capitalize">{project.category}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">Billing Date</p>
                <p className="text-sm text-slate-300">{project.automatedBillingDate || '\u2014'}</p>
              </div>
              {project.automatedNotes && (
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-600">Notes</p>
                  <p className="text-xs text-slate-400">{project.automatedNotes}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-full">
                Manual override
              </span>
              <p className="text-[10px] text-slate-500">These values supplement but do not overwrite automated data</p>
            </div>

            <div className={`space-y-4 ${isArchived ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Monthly Running Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">{'\u00A3'}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.monthlyRunningCost}
                      onChange={(e) => updateField('monthlyRunningCost', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
                      disabled={isArchived}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Manual Revenue Estimate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">{'\u00A3'}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.manualRevenueEstimate}
                      onChange={(e) => updateField('manualRevenueEstimate', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
                      disabled={isArchived}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Build Status</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '', label: 'None' },
                    { value: 'planning', label: 'Planning' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'uat', label: 'UAT' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'live', label: 'Live' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateField('currentBuildStatus', opt.value)}
                      disabled={isArchived}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                        form.currentBuildStatus === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-indigo-500/30 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Health Status</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '', label: 'None' },
                    { value: 'healthy', label: 'Healthy', icon: 'ri-check-double-line' },
                    { value: 'degraded', label: 'Degraded', icon: 'ri-error-warning-line' },
                    { value: 'critical', label: 'Critical', icon: 'ri-close-circle-line' },
                    { value: 'unknown', label: 'Unknown', icon: 'ri-question-line' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateField('manualHealthStatus', opt.value)}
                      disabled={isArchived}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                        form.manualHealthStatus === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-indigo-500/30 hover:text-white'
                      }`}
                    >
                      {opt.icon && (
                        <div className="w-3 h-3 flex items-center justify-center"><i className={opt.icon + ' text-[9px]'}></i></div>
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Launch Target Date</label>
                <input
                  type="date"
                  value={form.launchTargetDate}
                  onChange={(e) => updateField('launchTargetDate', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
                  disabled={isArchived}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Current Blockers</label>
                <textarea
                  value={form.currentBlockers}
                  onChange={(e) => updateField('currentBlockers', e.target.value)}
                  placeholder="Any blockers or issues..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 resize-none"
                  rows={2}
                  maxLength={500}
                  disabled={isArchived}
                />
                <p className="text-[9px] text-slate-600 mt-1 text-right">{form.currentBlockers.length}/500</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="General notes about this project..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 resize-none"
                  rows={2}
                  maxLength={500}
                  disabled={isArchived}
                />
                <p className="text-[9px] text-slate-600 mt-1 text-right">{form.notes.length}/500</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Latest Deployment Notes</label>
                <textarea
                  value={form.latestDeploymentNotes}
                  onChange={(e) => updateField('latestDeploymentNotes', e.target.value)}
                  placeholder="What was deployed last and when..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 resize-none"
                  rows={2}
                  maxLength={500}
                  disabled={isArchived}
                />
                <p className="text-[9px] text-slate-600 mt-1 text-right">{form.latestDeploymentNotes.length}/500</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a2b4a]">
          <div>
            {isSuperAdmin && project.metricId && (
              <button
                onClick={handleArchive}
                disabled={saving || isArchived}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-red-400 hover:text-white hover:bg-red-500/20 transition-all cursor-pointer whitespace-nowrap border border-red-500/20 hover:border-red-500/40 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="w-3 h-3 flex items-center justify-center"><i className="ri-archive-line text-[10px]"></i></div>
                Archive
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            {isSuperAdmin && !isArchived && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-900/50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                    Save Metrics
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}