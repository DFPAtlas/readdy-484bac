'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface DeploymentInfo {
  id: string | null;
  github_url: string | null;
  branch_name: string | null;
  commit_hash: string | null;
  commit_message: string | null;
  deployment_status: string | null;
  build_status: string | null;
  build_error_summary: string | null;
  deployed_at: string | null;
}

interface DeploymentDetailModalProps {
  projectName: string;
  deployment: DeploymentInfo | null;
  onClose: () => void;
  onSaved: () => void;
  isSuperAdmin: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function DeploymentDetailModal({ projectName, deployment, onClose, onSaved, isSuperAdmin, showToast }: DeploymentDetailModalProps) {
  const admin = useAdminAuth();
  const [form, setForm] = useState({
    githubUrl: '',
    branchName: '',
    commitHash: '',
    commitMessage: '',
    deploymentStatus: '',
    buildStatus: '',
    buildErrorSummary: '',
    deployedAt: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deployment) {
      setForm({
        githubUrl: deployment.github_url || '',
        branchName: deployment.branch_name || '',
        commitHash: deployment.commit_hash || '',
        commitMessage: deployment.commit_message || '',
        deploymentStatus: deployment.deployment_status || '',
        buildStatus: deployment.build_status || '',
        buildErrorSummary: deployment.build_error_summary || '',
        deployedAt: deployment.deployed_at ? deployment.deployed_at.slice(0, 16) : '',
      });
    }
  }, [deployment]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      showToast('Only super-admins can edit deployment data', 'error');
      return;
    }

    setSaving(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;

      const payload = {
        app_slug: projectName.toLowerCase(),
        github_url: form.githubUrl || null,
        branch_name: form.branchName || null,
        commit_hash: form.commitHash || null,
        commit_message: form.commitMessage || null,
        deployment_status: form.deploymentStatus || 'pending',
        build_status: form.buildStatus || 'pending',
        build_error_summary: form.buildErrorSummary || null,
        deployed_at: form.deployedAt ? new Date(form.deployedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (deployment?.id) {
        result = await supabase
          .from('digital_footprint_deployments')
          .update(payload)
          .eq('id', deployment.id)
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('digital_footprint_deployments')
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
        action_type: deployment?.id ? 'update_deployment_data' : 'create_deployment_data',
        action_description: deployment?.id
          ? `Updated deployment data for ${projectName}`
          : `Created deployment data for ${projectName}`,
        target_type: 'digital_footprint_deployments',
        target_name: projectName,
        metadata: {
          project_name: projectName,
          changes: payload,
          previous: deployment,
        },
      });

      showToast('Deployment data saved', 'success');
      onSaved();
    } catch (err) {
      console.error('Save error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setSaving(false);
    }
  };

  const buildFailed = deployment?.build_status === 'failed';
  const buildPending = deployment?.build_status === 'pending' || deployment?.deployment_status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
              <i className="ri-git-repository-line"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{projectName}</h3>
              <p className="text-[10px] text-slate-500">Deployment &amp; build tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer">
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!deployment && (
            <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                <i className="ri-information-line text-sm"></i>
              </div>
              <p className="text-xs text-slate-400">
                Awaiting deployment data. This record is ready for n8n or GitHub webhook updates.
              </p>
            </div>
          )}

          {buildFailed && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-red-400 mt-0.5">
                <i className="ri-close-circle-line text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-red-400 font-semibold">Build Failed</p>
                {deployment?.build_error_summary && (
                  <p className="text-[11px] text-red-400/70 mt-1">{deployment.build_error_summary}</p>
                )}
                {deployment?.deployed_at && (
                  <p className="text-[10px] text-red-400/50 mt-1">
                    Last attempt: {new Date(deployment.deployed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {buildPending && !buildFailed && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-amber-400">
                <i className="ri-loader-4-line animate-spin text-sm"></i>
              </div>
              <p className="text-xs text-amber-400 font-medium">Deployment pending</p>
            </div>
          )}

          {deployment?.deployment_status === 'deployed' && deployment?.build_status === 'success' && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-emerald-400">
                <i className="ri-check-double-line text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-semibold">Deployed Successfully</p>
                {deployment?.deployed_at && (
                  <p className="text-[10px] text-emerald-400/50 mt-1">
                    {new Date(deployment.deployed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider bg-teal-500/10 px-2 py-0.5 rounded-full">
                Deployment config
              </span>
              {!isSuperAdmin && (
                <span className="text-[9px] text-slate-600 italic ml-auto">Read-only</span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-github-line text-[11px]"></i></div>
                  GitHub Repo URL
                </label>
                <input
                  type="url"
                  value={form.githubUrl}
                  onChange={(e) => updateField('githubUrl', e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-git-branch-line text-[11px]"></i></div>
                    Branch
                  </label>
                  <input
                    type="text"
                    value={form.branchName}
                    onChange={(e) => updateField('branchName', e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40"
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-git-commit-line text-[11px]"></i></div>
                    Commit Hash
                  </label>
                  <input
                    type="text"
                    value={form.commitHash}
                    onChange={(e) => updateField('commitHash', e.target.value)}
                    placeholder="abc123f"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40"
                    disabled={!isSuperAdmin}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-chat-3-line text-[11px]"></i></div>
                  Commit Message
                </label>
                <input
                  type="text"
                  value={form.commitMessage}
                  onChange={(e) => updateField('commitMessage', e.target.value)}
                  placeholder="Latest commit message..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-rocket-line text-[11px]"></i></div>
                    Deployment Status
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'pending', label: 'Pending' },
                      { value: 'deploying', label: 'Deploying' },
                      { value: 'deployed', label: 'Deployed' },
                      { value: 'failed', label: 'Failed' },
                      { value: 'rolled_back', label: 'Rolled Back' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateField('deploymentStatus', opt.value)}
                        disabled={!isSuperAdmin}
                        className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                          form.deploymentStatus === opt.value
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-teal-500/30 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-tools-line text-[11px]"></i></div>
                    Build Status
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'pending', label: 'Pending' },
                      { value: 'building', label: 'Building' },
                      { value: 'success', label: 'Success' },
                      { value: 'failed', label: 'Failed' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateField('buildStatus', opt.value)}
                        disabled={!isSuperAdmin}
                        className={`px-2 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                          form.buildStatus === opt.value
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-teal-500/30 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Deployed At</label>
                <input
                  type="datetime-local"
                  value={form.deployedAt}
                  onChange={(e) => updateField('deployedAt', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-error-warning-line text-[11px]"></i></div>
                  Build Error Summary
                </label>
                <textarea
                  value={form.buildErrorSummary}
                  onChange={(e) => updateField('buildErrorSummary', e.target.value)}
                  placeholder="Error logs or failure reason..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 resize-none"
                  rows={3}
                  maxLength={1000}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-slate-600 mt-1 text-right">{form.buildErrorSummary.length}/1000</p>
              </div>
            </div>
          </div>

          {!isSuperAdmin && deployment && (
            <div className="bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Latest snapshot</p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {deployment.github_url && (
                  <div className="col-span-2">
                    <span className="text-slate-600">Repo: </span>
                    <span className="text-slate-400 font-mono text-[10px] break-all">{deployment.github_url}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-600">Branch: </span>
                  <span className="text-slate-300 font-mono">{deployment.branch_name || '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Commit: </span>
                  <span className="text-slate-300 font-mono">{deployment.commit_hash ? deployment.commit_hash.slice(0, 7) : '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Deployment: </span>
                  <span className="text-slate-300">{deployment.deployment_status || '\u2014'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Build: </span>
                  <span className="text-slate-300">{deployment.build_status || '\u2014'}</span>
                </div>
                {deployment.deployed_at && (
                  <div className="col-span-2">
                    <span className="text-slate-600">Deployed: </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(deployment.deployed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-teal-900/50"
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