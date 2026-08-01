'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import PreferenceToggle from './PreferenceToggle';
import SaveToast from './SaveToast';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useRouter } from 'next/navigation';

interface Preferences {
  job_matches: boolean;
  application_updates: boolean;
  payment_notifications: boolean;
  messages: boolean;
  sia_reminders: boolean;
  email_frequency: string;
}

interface GuardPreferences {
  max_distance_miles: number;
  min_hourly_rate: number;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, success: true, message: '' });
  const [displayName, setDisplayName] = useState('Guard');
  const [initials, setInitials] = useState('G');
  const { checking, blocked } = useRouteGuard();
  const { loading: authLoading, allowed } = useGuardGuard();

  const [preferences, setPreferences] = useState<Preferences>({
    job_matches: true,
    application_updates: true,
    payment_notifications: true,
    messages: true,
    sia_reminders: true,
    email_frequency: 'instant',
  });

  const [guardPreferences, setGuardPreferences] = useState<GuardPreferences>({
    max_distance_miles: 25,
    min_hourly_rate: 10.0,
  });

  const [lastDigestSent, setLastDigestSent] = useState<string | null>(null);
  const [lastWeeklyDigestSent, setLastWeeklyDigestSent] = useState<string | null>(null);
  const [digestInfo, setDigestInfo] = useState<{ show: boolean; type: 'daily' | 'weekly' | null }>({ show: false, type: null });

  const showToast = (success: boolean, message: string) => {
    setToast({ show: true, success, message });
  };

  const loadPreferences = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*, last_digest_sent_at, last_weekly_digest_sent_at')
        .eq('user_id', uid)
        .maybeSingle();

      if (notifPrefs) {
        setPreferences({
          job_matches: notifPrefs.job_matches ?? true,
          application_updates: notifPrefs.application_updates ?? true,
          payment_notifications: notifPrefs.payment_notifications ?? true,
          messages: notifPrefs.messages ?? true,
          sia_reminders: notifPrefs.sia_reminders ?? true,
          email_frequency: notifPrefs.email_frequency || 'instant',
        });
        setLastDigestSent(notifPrefs.last_digest_sent_at || null);
        setLastWeeklyDigestSent(notifPrefs.last_weekly_digest_sent_at || null);
      }

      const { data: guardData } = await supabase
        .from('guards')
        .select('full_name, max_distance_miles, min_hourly_rate')
        .eq('user_id', uid)
        .maybeSingle();

      if (guardData) {
        setGuardPreferences({
          max_distance_miles: guardData.max_distance_miles || 25,
          min_hourly_rate: guardData.min_hourly_rate || 10.0,
        });
        setDisplayName(guardData.full_name || 'Guard');
        setInitials(
          (guardData.full_name || 'Guard')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
        );
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const freq = preferences.email_frequency;
    if (freq === 'daily') {
      setDigestInfo({ show: true, type: 'daily' });
    } else if (freq === 'weekly') {
      setDigestInfo({ show: true, type: 'weekly' });
    } else {
      setDigestInfo({ show: false, type: null });
    }
  }, [preferences.email_frequency]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/guard/login');
        return;
      }
      setUserId(user.id);
      await loadPreferences(user.id);
    };
    checkAuth();
  }, [loadPreferences]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error: notifError } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() });

      if (notifError) throw notifError;

      const { error: guardError } = await supabase
        .from('guards')
        .update(guardPreferences)
        .eq('user_id', userId);

      if (guardError) throw guardError;

      showToast(true, 'Notification settings saved successfully!');
    } catch (error: any) {
      showToast(false, `Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const setPref = (key: keyof Preferences, value: boolean | string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const frequencyOptions = [
    { value: 'instant', label: 'Instant', desc: 'As soon as it happens' },
    { value: 'daily', label: 'Daily Digest', desc: 'Once per day summary' },
    { value: 'weekly', label: 'Weekly', desc: 'Once per week summary' },
    { value: 'none', label: 'None', desc: 'No email notifications' },
  ];

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex">
        <PortalSidebar
          role="guard"
          displayName={displayName}
          subtitle="Guard"
          initials={initials}
        />
        <main className="flex-1 ml-72 flex items-center justify-center">
          <div className="text-center">
            <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
            <p className="mt-4 text-slate-400">Loading settings...</p>
          </div>
        </main>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <UpgradePrompt feature="guard.priority_support" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={displayName}
        subtitle="Guard"
        initials={initials}
      />
      <main className="flex-1 ml-72">
        <div className="max-w-3xl mx-auto px-6 py-10">

          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/guard/dashboard"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#1e2d4d] bg-white dark:bg-[#162036] hover:bg-slate-50 dark:hover:bg-[#1a2642] transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-slate-500 dark:text-slate-400 text-lg"></i>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notification Preferences</h1>
              <p className="text-sm text-slate-500 mt-0.5">Control which alerts you receive and how</p>
            </div>
          </div>

          <div className="space-y-6">

            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-[#1e2d4d]">
                <div className="w-10 h-10 bg-teal-50 dark:bg-teal-500/15 rounded-xl flex items-center justify-center">
                  <i className="ri-notification-3-line text-xl text-teal-500 dark:text-teal-400"></i>
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Alert Types</h2>
                  <p className="text-xs text-slate-500">Choose which notifications you want to receive</p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <PreferenceToggle
                  label="Job Match Alerts"
                  description="Get notified when a new job matches your security type and location"
                  checked={preferences.job_matches}
                  onChange={(v) => setPref('job_matches', v)}
                  icon="ri-briefcase-line"
                  iconBg="bg-teal-100"
                  iconColor="text-teal-600"
                />
                <PreferenceToggle
                  label="Application Updates"
                  description="Know when your applications are accepted, rejected, or reviewed"
                  checked={preferences.application_updates}
                  onChange={(v) => setPref('application_updates', v)}
                  icon="ri-file-list-3-line"
                  iconBg="bg-blue-500/15"
                  iconColor="text-blue-600"
                />
                <PreferenceToggle
                  label="Payment Notifications"
                  description="Alerts when payments are processed or payouts are sent"
                  checked={preferences.payment_notifications}
                  onChange={(v) => setPref('payment_notifications', v)}
                  icon="ri-money-pound-circle-line"
                  iconBg="bg-emerald-500/15"
                  iconColor="text-green-600"
                />
                <PreferenceToggle
                  label="Messages from Clients"
                  description="Notifications when clients send you messages or responses"
                  checked={preferences.messages}
                  onChange={(v) => setPref('messages', v)}
                  icon="ri-message-3-line"
                  iconBg="bg-purple-100"
                  iconColor="text-purple-600"
                />
                <PreferenceToggle
                  label="SIA License Reminders"
                  description="Reminders before your SIA license is due to expire"
                  checked={preferences.sia_reminders}
                  onChange={(v) => setPref('sia_reminders', v)}
                  icon="ri-shield-check-line"
                  iconBg="bg-orange-100"
                  iconColor="text-orange-600"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-[#1e2d4d]">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/15 rounded-xl flex items-center justify-center">
                  <i className="ri-mail-send-line text-xl text-blue-500 dark:text-blue-400"></i>
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Email Frequency</h2>
                  <p className="text-xs text-slate-500">How often should we send you email summaries</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-3">
                {frequencyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPref('email_frequency', opt.value)}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      preferences.email_frequency === opt.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/5'
                        : 'border-slate-100 dark:border-[#162036] bg-white dark:bg-[#0B1933] hover:border-slate-200 dark:hover:border-[#1e2d4d]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`font-semibold text-sm ${preferences.email_frequency === opt.value ? 'text-teal-600 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {opt.label}
                      </span>
                      {preferences.email_frequency === opt.value && (
                        <i className="ri-checkbox-circle-fill text-teal-500 text-base"></i>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
              {digestInfo.show && (
                <div className="px-6 pb-6">
                  <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/15 flex-shrink-0">
                        <i className="ri-information-line text-blue-600 dark:text-blue-400 text-lg"></i>
                      </div>
                      <div>
                        {digestInfo.type === 'daily' && (
                          <>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Daily Digest at 8:00 AM</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              You will receive a single email every morning at 8:00 AM with a summary of all your notifications from the past 24 hours. This helps you stay informed without cluttering your inbox.
                            </p>
                            {lastDigestSent && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Last digest sent: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(lastDigestSent).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            )}
                          </>
                        )}
                        {digestInfo.type === 'weekly' && (
                          <>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Weekly Round-up every Monday at 8:00 AM</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              You will receive one email every Monday at 8:00 AM with a summary of all your notifications from the past 7 days. Perfect if you prefer to check in once a week.
                            </p>
                            {lastWeeklyDigestSent && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Last round-up sent: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(lastWeeklyDigestSent).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-[#1e2d4d]">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-500/15 rounded-xl flex items-center justify-center">
                  <i className="ri-filter-3-line text-xl text-green-600 dark:text-green-400"></i>
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Job Match Filters</h2>
                  <p className="text-xs text-slate-500">Only get notified about jobs that meet your criteria</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white">Maximum Distance</label>
                      <p className="text-xs text-slate-500 mt-0.5">Only notify me about jobs within this range</p>
                    </div>
                    <span className="text-lg font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-lg">
                      {guardPreferences.max_distance_miles} mi
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={guardPreferences.max_distance_miles}
                    onChange={(e) =>
                      setGuardPreferences(prev => ({ ...prev, max_distance_miles: parseInt(e.target.value) }))
                    }
                    className="w-full h-2 bg-slate-100 dark:bg-[#162036] rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>5 mi</span>
                    <span>100 mi</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white">Minimum Hourly Rate</label>
                      <p className="text-xs text-slate-500 mt-0.5">Only notify me about jobs paying at least this rate</p>
                    </div>
                    <span className="text-lg font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-lg">
                      £{Number(guardPreferences.min_hourly_rate).toFixed(2)}/hr
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-semibold text-lg">£</span>
                    <input
                      type="number"
                      min="8"
                      max="100"
                      step="0.50"
                      value={guardPreferences.min_hourly_rate}
                      onChange={(e) =>
                        setGuardPreferences(prev => ({ ...prev, min_hourly_rate: parseFloat(e.target.value) || 0 }))
                      }
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-semibold outline-none text-slate-900 dark:text-white"
                    />
                    <span className="text-slate-500 text-sm">/hour</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-teal-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-save-3-line text-lg"></i>
                    Save Preferences
                  </>
                )}
              </button>
              <Link
                href="/guard/dashboard"
                className="px-6 py-4 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                Back
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SaveToast
        show={toast.show}
        success={toast.success}
        message={toast.message}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}
