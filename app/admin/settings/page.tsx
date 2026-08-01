'use client';


import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  setScheduledMaintenance,
  clearScheduledMaintenance,
  isMaintenanceActive,
  getTimeUntil,
  formatDuration,
  type ScheduledMaintenance,
} from '@/lib/maintenance';
import MaintenanceBannerPreview from './MaintenanceBannerPreview';

interface MaintenanceState {
  mode: boolean;
  schedule: ScheduledMaintenance | null;
}

export default function AdminSettingsPage() {
  const [state, setState] = useState<MaintenanceState>({ mode: false, schedule: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  // Schedule form
  const [scheduleForm, setScheduleForm] = useState({
    start: '',
    end: '',
    message: '',
    notify: false,
    notifyMinutes: '60',
    notifyRecipients: 'all',
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [notifySending, setNotifySending] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['maintenance_mode', 'maintenance_scheduled_start', 'maintenance_scheduled_end', 'maintenance_message']);

      if (error) throw error;

      const find = (key: string) => (data || []).find((d: any) => d.key === key)?.value || '';

      const mode = find('maintenance_mode') === 'true';
      const start = find('maintenance_scheduled_start');
      const end = find('maintenance_scheduled_end');
      const msg = find('maintenance_message');

      const schedule: ScheduledMaintenance | null = (start && end)
        ? { start, end, message: msg }
        : null;

      setState({ mode, schedule });

      if (schedule) {
        setScheduleForm({
          start: toLocalInput(schedule.start),
          end: toLocalInput(schedule.end),
          message: schedule.message,
          notify: false,
          notifyMinutes: '60',
          notifyRecipients: 'all',
        });
      }
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Countdown ticker
  useEffect(() => {
    const tick = () => {
      if (!state.schedule?.start || !state.schedule?.end) {
        setCountdown('');
        return;
      }
      const info = getTimeUntil(state.schedule);
      if (!info) {
        setCountdown('');
        return;
      }
      setCountdown(`${info.label} ${formatDuration(info.seconds)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.schedule]);

  async function toggleMaintenanceMode() {
    setSaving(true);
    const newValue = !state.mode;
    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: newValue ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('key', 'maintenance_mode');
      if (error) throw error;
      setState(prev => ({ ...prev, mode: newValue }));
      showToast(newValue ? 'Maintenance mode is now ON' : 'Maintenance mode is now OFF', 'success');

      supabase.from('admin_activity_log').insert({
        action: newValue ? 'maintenance_mode_on' : 'maintenance_mode_off',
        action_description: `Maintenance mode turned ${newValue ? 'ON' : 'OFF'}`,
        entity_type: 'settings',
        details: { mode: newValue },
      }).catch(() => {});
    } catch {
      showToast('Failed to update maintenance mode', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.start || !scheduleForm.end) {
      showToast('Start and end times are required', 'error');
      return;
    }
    if (new Date(scheduleForm.start) >= new Date(scheduleForm.end)) {
      showToast('End time must be after start time', 'error');
      return;
    }

    setSaving(true);
    try {
      const schedule: ScheduledMaintenance = {
        start: new Date(scheduleForm.start).toISOString(),
        end: new Date(scheduleForm.end).toISOString(),
        message: scheduleForm.message.trim(),
      };
      const ok = await setScheduledMaintenance(schedule);
      if (!ok) throw new Error('Save failed');

      setState(prev => ({ ...prev, schedule }));
      setShowScheduleForm(false);
      showToast('Scheduled maintenance saved successfully', 'success');

      supabase.from('admin_activity_log').insert({
        action: 'maintenance_schedule_saved',
        action_description: `Scheduled maintenance from ${schedule.start} to ${schedule.end}`,
        entity_type: 'settings',
        details: { start: schedule.start, end: schedule.end, message: schedule.message },
      }).catch(() => {});

      if (scheduleForm.notify) {
        sendMaintenanceNotification(scheduleForm.message);
      }
    } catch {
      showToast('Failed to save scheduled maintenance', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function sendMaintenanceNotification(message: string) {
    setNotifySending(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-maintenance-notification`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          recipients: scheduleForm.notifyRecipients,
          startTime: new Date(scheduleForm.start).toISOString(),
          endTime: new Date(scheduleForm.end).toISOString(),
          message: message || scheduleForm.message.trim(),
          noticeMinutes: parseInt(scheduleForm.notifyMinutes, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Send failed');

      const sentCount = data.sent || 0;
      const failedCount = data.failed || 0;
      const totalCount = data.total || 0;

      if (failedCount > 0 && sentCount > 0) {
        showToast(`Sent ${sentCount} of ${totalCount} emails. ${failedCount} failed.`, 'error');
      } else if (failedCount > 0 && sentCount === 0) {
        showToast(`All ${failedCount} emails failed to send.`, 'error');
      } else if (sentCount === 0) {
        showToast('No matching users found to notify.', 'success');
      } else {
        showToast(`Sent ${sentCount} email${sentCount !== 1 ? 's' : ''} successfully.`, 'success');
      }

      supabase.from('admin_activity_log').insert({
        action: 'maintenance_notification_sent',
        action_description: `Maintenance notification sent to ${scheduleForm.notifyRecipients}: ${sentCount} sent, ${failedCount} failed`,
        entity_type: 'settings',
        details: {
          recipients: scheduleForm.notifyRecipients,
          sent: sentCount,
          failed: failedCount,
          total: totalCount,
          startTime: new Date(scheduleForm.start).toISOString(),
          endTime: new Date(scheduleForm.end).toISOString(),
        },
      }).catch(() => {});
    } catch {
      showToast('Failed to send maintenance notification email', 'error');
    } finally {
      setNotifySending(false);
    }
  }

  async function cancelSchedule() {
    setSaving(true);
    try {
      const ok = await clearScheduledMaintenance();
      if (!ok) throw new Error('Clear failed');
      setState(prev => ({ ...prev, schedule: null }));
      setScheduleForm({ start: '', end: '', message: '', notify: false, notifyMinutes: '60', notifyRecipients: 'all' });
      showToast('Scheduled maintenance cancelled', 'success');

      supabase.from('admin_activity_log').insert({
        action: 'maintenance_schedule_cancelled',
        action_description: 'Scheduled maintenance cancelled',
        entity_type: 'settings',
        details: {},
      }).catch(() => {});
    } catch {
      showToast('Failed to cancel scheduled maintenance', 'error');
    } finally {
      setSaving(false);
    }
  }

  const scheduledActive = state.schedule ? isMaintenanceActive(state.schedule) : false;
  const hasSchedule = !!state.schedule?.start && !!state.schedule?.end;

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/admin/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <i className="ri-arrow-right-s-line text-slate-500" />
          <span className="text-sm text-slate-400">Site Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Site Settings</h1>
        <p className="text-slate-400 mt-1">Manage global site configuration and maintenance mode.</p>
      </div>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`} />
          </div>
          {toast.message}
        </div>
      )}

      {/* Manual Maintenance */}
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 md:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-shut-down-line text-teal-400 text-lg" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Manual Maintenance Mode</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg">
              Instantly toggle maintenance on or off. Overrides any scheduled maintenance.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-500 border-t-transparent" />
            <span className="text-sm text-slate-400">Loading status...</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 border-t border-[#1a2b4a]">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${state.mode ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="font-medium text-slate-200">
                  {state.mode ? 'Maintenance mode is ON' : 'Maintenance mode is OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                {state.mode
                  ? 'Visitors are being redirected to the maintenance page.'
                  : 'The site is live and accessible to all visitors.'}
              </p>
            </div>

            <button
              onClick={toggleMaintenanceMode}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                state.mode
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {saving ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <i className={`${state.mode ? 'ri-play-line' : 'ri-shut-down-line'}`} />
                )}
              </div>
              {saving ? 'Updating...' : state.mode ? 'Turn Off Maintenance' : 'Turn On Maintenance'}
            </button>
          </div>
        )}
      </div>

      {/* Maintenance Page Preview */}
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 md:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-eye-line text-indigo-400 text-lg" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Maintenance Page Preview</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg">
              This is exactly what visitors will see when the site is in maintenance mode.
            </p>
          </div>
        </div>
        <div className="border-t border-[#1a2b4a] pt-5">
          <MaintenanceBannerPreview message={state.schedule?.message || ''} />
        </div>
      </div>

      {/* Scheduled Maintenance */}
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 md:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-time-line text-amber-400 text-lg" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Scheduled Maintenance</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg">
              Automatically enable maintenance mode between specific dates/times. No need to manually toggle.
            </p>
          </div>
          {!showScheduleForm && (
            <button
              onClick={() => setShowScheduleForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-slate-900 transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Schedule
            </button>
          )}
        </div>

        {hasSchedule && !showScheduleForm && (
          <div className="border-t border-[#1a2b4a] pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {scheduledActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      ACTIVE NOW
                    </span>
                  ) : new Date() < new Date(state.schedule!.start) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <i className="ri-calendar-schedule-line" />
                      SCHEDULED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      <i className="ri-check-line" />
                      COMPLETED
                    </span>
                  )}
                  {countdown && (
                    <span className="text-xs text-slate-400 font-mono bg-[#0B1933] px-2 py-1 rounded-lg border border-[#1a2b4a]">
                      {countdown}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-300 space-y-1">
                  <p className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-calendar-line text-slate-500" />
                    </div>
                    Start: <span className="font-medium text-white">{formatDateTime(state.schedule!.start)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-calendar-check-line text-slate-500" />
                    </div>
                    End: <span className="font-medium text-white">{formatDateTime(state.schedule!.end)}</span>
                  </p>
                  {state.schedule!.message && (
                    <p className="flex items-start gap-2 text-slate-400 italic mt-2">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5">
                        <i className="ri-message-3-line text-slate-500" />
                      </div>
                      &ldquo;{state.schedule!.message}&rdquo;
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScheduleForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#1a2b4a] hover:bg-[#243656] text-slate-300 border border-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-pencil-line" />
                  </div>
                  Edit
                </button>
                <button
                  onClick={cancelSchedule}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {saving ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-400 border-t-transparent" />
                    ) : (
                      <i className="ri-delete-bin-line" />
                    )}
                  </div>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!hasSchedule && !showScheduleForm && (
          <div className="border-t border-[#1a2b4a] pt-5 text-center py-6">
            <div className="w-12 h-12 bg-[#1a2b4a] border border-[#243656] rounded-xl flex items-center justify-center mx-auto mb-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-calendar-todo-line text-slate-500" />
              </div>
            </div>
            <p className="text-sm text-slate-400">No scheduled maintenance set.</p>
            <p className="text-xs text-slate-500 mt-1">Use the Schedule button above to plan maintenance windows.</p>
          </div>
        )}

        {showScheduleForm && (
          <form onSubmit={saveSchedule} className="border-t border-[#1a2b4a] pt-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.start}
                  onChange={e => setScheduleForm(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#1a2b4a] text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[#0B1933] [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.end}
                  onChange={e => setScheduleForm(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#1a2b4a] text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[#0B1933] [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Message (optional)</label>
              <input
                type="text"
                placeholder="e.g. Database upgrade in progress"
                value={scheduleForm.message}
                onChange={e => setScheduleForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#1a2b4a] text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[#0B1933] placeholder-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">Shown on the maintenance page to visitors.</p>
            </div>

            {/* Email Notification */}
            <div className="bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleForm(prev => ({ ...prev, notify: !prev.notify }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    scheduleForm.notify ? 'bg-teal-500' : 'bg-[#1a2b4a]'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    scheduleForm.notify ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
                <div>
                  <label className="text-sm font-semibold text-slate-200">Notify users by email</label>
                  <p className="text-xs text-slate-500">Send an email when this scheduled maintenance is saved.</p>
                </div>
              </div>

              {scheduleForm.notify && (
                <div className="space-y-3 pl-14">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Who to notify</label>
                      <div className="flex bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-1">
                        {(['all','clients','guards'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setScheduleForm(prev => ({ ...prev, notifyRecipients: type }))}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                              scheduleForm.notifyRecipients === type
                                ? 'bg-teal-500 text-slate-900'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {type === 'all' ? 'All Users' : type === 'clients' ? 'Clients Only' : 'Guards Only'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Send notice before</label>
                      <div className="flex bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-1">
                        {(['15','30','60','120'] as const).map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setScheduleForm(prev => ({ ...prev, notifyMinutes: mins }))}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                              scheduleForm.notifyMinutes === mins
                                ? 'bg-teal-500 text-slate-900'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || notifySending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-slate-900 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {saving || notifySending ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-900 border-t-transparent" />
                  ) : (
                    <i className="ri-check-line" />
                  )}
                </div>
                {saving ? 'Saving...' : notifySending ? 'Sending...' : 'Save Schedule'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleForm(false);
                  if (state.schedule) {
                    setScheduleForm({
                      start: toLocalInput(state.schedule.start),
                      end: toLocalInput(state.schedule.end),
                      message: state.schedule.message,
                      notify: false,
                      notifyMinutes: '60',
                      notifyRecipients: 'all',
                    });
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[#1a2b4a] hover:bg-[#243656] text-slate-300 border border-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-line" />
                </div>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Info */}
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 md:p-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-information-line text-slate-500" />
          </div>
          What happens during maintenance?
        </h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center mt-0.5">
              <i className="ri-arrow-right-s-line text-teal-400" />
            </div>
            All public pages redirect to a maintenance screen. Admin stays accessible.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center mt-0.5">
              <i className="ri-arrow-right-s-line text-teal-400" />
            </div>
            Manual toggle always overrides scheduled maintenance — great for emergencies.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center mt-0.5">
              <i className="ri-arrow-right-s-line text-teal-400" />
            </div>
            The maintenance screen checks every 10 seconds and auto-redirects when the site is back.
          </li>
        </ul>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}