'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface EmergencyAction {
  id: string;
  settingKey: string;
  label: string;
  description: string;
  icon: string;
  destructive: boolean;
}

const emergencyActions: EmergencyAction[] = [
  { id: 'maintenance', settingKey: 'emergency_maintenance_mode', label: 'Enable Maintenance Mode', description: 'Show maintenance page to all non-admin users', icon: 'ri-tools-line', destructive: false },
  { id: 'disable-reg', settingKey: 'emergency_disable_registrations', label: 'Disable Registrations', description: 'Prevent new user signups across all roles', icon: 'ri-user-add-line', destructive: false },
  { id: 'disable-jobs', settingKey: 'emergency_disable_jobs', label: 'Disable Job Posting', description: 'Prevent clients from posting new jobs', icon: 'ri-briefcase-line', destructive: false },
  { id: 'disable-payments', settingKey: 'emergency_disable_payments', label: 'Disable Client Payments', description: 'Pause all payment processing', icon: 'ri-bank-card-line', destructive: false },
  { id: 'disable-guard-apps', settingKey: 'emergency_disable_guard_apps', label: 'Disable Guard Applications', description: 'Prevent guards from applying to jobs', icon: 'ri-user-search-line', destructive: false },
  { id: 'readonly', settingKey: 'emergency_readonly_mode', label: 'Enable Read-Only Mode', description: 'All write operations blocked across platform', icon: 'ri-eye-line', destructive: false },
  { id: 'lock-platform', settingKey: 'emergency_lock_platform', label: 'Lock Platform', description: 'Only Super Admins can access the platform', icon: 'ri-lock-line', destructive: true },
  { id: 'logout-all', settingKey: 'emergency_logout_all', label: 'Emergency Logout All Users', description: 'Force all user sessions to expire immediately', icon: 'ri-shut-down-line', destructive: true },
];

interface Props {
  settings: Record<string, string>;
  onSettingChange: () => void;
}

export default function EmergencyControls({ settings, onSettingChange }: Props) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = (key: string) => (settings || {})[key] === 'true';

  const handleAction = async (action: EmergencyAction) => {
    if (!settings) return;
    const newValue = isActive(action.settingKey) ? 'false' : 'true';
    setSaving(true);
    setError(null);
    setConfirmAction(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('security-dashboard', {
        body: {
          action: 'set_emergency_setting',
          key: action.settingKey,
          value: newValue,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setLastAction(action.label);
      setTimeout(() => setLastAction(null), 5000);
      onSettingChange();
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = emergencyActions.filter(a => isActive(a.settingKey)).length;

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
      {lastAction && (
        <div className="mx-5 mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-emerald-400"></i>
          <p className="text-sm text-emerald-300">Action "{lastAction}" executed successfully</p>
          <button onClick={() => setLastAction(null)} className="ml-auto text-emerald-400 hover:text-emerald-300 text-xs cursor-pointer"><i className="ri-close-line"></i></button>
        </div>
      )}
      {error && (
        <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
          <i className="ri-error-warning-fill text-red-400"></i>
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 text-xs cursor-pointer"><i className="ri-close-line"></i></button>
        </div>
      )}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#0a1628] transition-colors"
        onClick={() => setShowPanel(!showPanel)}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-red-500/10 rounded-lg">
            <i className="ri-alarm-warning-fill text-red-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Emergency Controls</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400">Super Admin Only</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">{activeCount} active</span>
          )}
        </div>
        <i className={`${showPanel ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-slate-400 text-lg transition-transform`}></i>
      </div>

      {showPanel && (
        <div className="px-5 pb-5 border-t border-[#1a2b4a] pt-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
            <i className="ri-error-warning-fill text-red-400 mt-0.5"></i>
            <div>
              <p className="text-sm font-semibold text-red-300">Warning: Emergency Controls</p>
              <p className="text-xs text-red-400/70 mt-1">These actions affect the entire platform and persist across sessions. Each action requires explicit confirmation. Only available to Super Admins.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {emergencyActions.map((action) => {
              const active = isActive(action.settingKey);
              return (
                <div key={action.id} className={`bg-[#0a1628] rounded-xl border p-4 transition-colors ${active ? 'border-red-500/40 bg-red-500/5' : action.destructive ? 'border-red-500/20' : 'border-amber-500/10'}`}>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg mb-3 ${action.destructive || active ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                    <i className={`${action.icon} text-sm ${action.destructive || active ? 'text-red-400' : 'text-amber-400'}`}></i>
                  </div>
                  <p className="text-sm font-medium text-slate-200 mb-1">{action.label}</p>
                  <p className="text-xs text-slate-500 mb-3">{action.description}</p>
                  {active && (
                    <span className="inline-block mb-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                      ACTIVE
                    </span>
                  )}
                  {confirmAction === action.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(action)}
                        disabled={saving}
                        className="flex-1 px-2 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="px-2 py-1.5 text-xs font-medium text-slate-400 bg-[#1a2b4a] rounded-lg hover:bg-[#1e2d4d] transition cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmAction(action.id)}
                      className={`w-full px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' : action.destructive ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'}`}
                    >
                      {active ? 'Disable' : 'Execute'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}