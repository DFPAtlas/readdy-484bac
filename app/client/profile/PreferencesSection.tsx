"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ClientPaymentMethodState, paymentMethodView } from '@/lib/client-payment-method';
import PaymentMethodStatus from './PaymentMethodStatus';

import { CLIENT_ALERT_KEYS, CLIENT_NOTIFICATION_DEFAULTS, ClientNotificationPreferences, ClientNotificationSnapshot, ClientNotificationError, loadClientNotificationPreferences, saveClientNotificationPreferences } from '@/lib/client-notification-preferences';

interface HealthData {
  profileComplete: boolean;
  billingAdded: boolean;
  firstJobPosted: boolean;
  notificationsSet: boolean;
  documentsUploaded: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
}

interface Props {
  profile: Profile;
  healthData: HealthData;
  paymentMethodState: ClientPaymentMethodState;
  onRefreshPaymentMethod: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const NOTIF_ITEMS = [
  { key: "new_applicants" as const, label: "New Applicants", desc: "When a guard applies to your job", icon: "ri-user-add-line" },
  { key: "guard_confirmations" as const, label: "Guard Confirmations", desc: "When a selected guard confirms", icon: "ri-shield-check-line" },
  { key: "payment_updates" as const, label: "Payment Updates", desc: "Payment success, failure, or refunds", icon: "ri-bank-card-line" },
  { key: "job_reminders" as const, label: "Job Reminders", desc: "Upcoming shifts and deadlines", icon: "ri-calendar-event-line" },
  { key: "support_tickets" as const, label: "Support Tickets", desc: "Replies to your support requests", icon: "ri-customer-service-2-line" },
  { key: "messages" as const, label: "Messages", desc: "New direct messages from guards", icon: "ri-message-3-line" },
];

const HEALTH_ITEMS = [
  { key: "profileComplete", label: "Company profile complete", icon: "ri-building-line" },
  { key: "billingAdded", label: "Billing details added", icon: "ri-bank-card-line" },
  { key: "firstJobPosted", label: "First job posted", icon: "ri-briefcase-line" },
  { key: "paymentMethodAdded", label: "Payment method added", icon: "ri-wallet-3-line" },
  { key: "notificationsSet", label: "Notification preferences set", icon: "ri-notification-3-line" },
  { key: "documentsUploaded", label: "Documents uploaded", icon: "ri-folder-3-line" },
];

export default function PreferencesSection({ profile, healthData, paymentMethodState, onRefreshPaymentMethod, onMessage }: Props) {
  const [prefs, setPrefs] = useState<ClientNotificationPreferences>({ ...CLIENT_NOTIFICATION_DEFAULTS });
  const [snapshot, setSnapshot] = useState<ClientNotificationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [accountChanged, setAccountChanged] = useState(false);
  const scope = `${profile.id}:${profile.user_id}`;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const mounted = useRef(false), lifetime = useRef(0), reads = useRef(0), operation = useRef(0);
  const busy = useRef(false), ready = useRef(false), dirty = useRef(false), passwordBusy = useRef(false);
  const authChanged = useRef(false);
  const retire = useCallback(() => { lifetime.current++; reads.current++; operation.current++; busy.current = false; ready.current = false; passwordBusy.current = false; }, []);
  const loadPreferences = useCallback(async () => {
    if (!mounted.current || busy.current) return;
    const id = ++reads.current, epoch = lifetime.current;
    const current = () => mounted.current && reads.current === id && lifetime.current === epoch && scopeRef.current === scope;
    ready.current = false;
    setLoading(true); setLoadError(false); setLoadedFor(scope); setSnapshot(null);
    try {
      const saved = await loadClientNotificationPreferences(supabase, profile.id, profile.user_id, current);
      if (current()) { setPrefs(saved.preferences); setSnapshot(saved); setAccountChanged(false); setFormError(''); dirty.current = false; ready.current = true; authChanged.current = false; }
    } catch { if (current()) setLoadError(true); }
    finally { if (current()) setLoading(false); }
  }, [profile.id, profile.user_id, scope]);
  useEffect(() => {
    mounted.current = true; dirty.current = false;
    setPrefs({ ...CLIENT_NOTIFICATION_DEFAULTS }); setFormError(''); setSaving(false); setPasswordLoading(false);
    void loadPreferences();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user?.id !== profile.user_id)) {
        authChanged.current = true;
        retire(); dirty.current = false; setSnapshot(null); setPrefs({ ...CLIENT_NOTIFICATION_DEFAULTS }); setFormError('');
        setAccountChanged(true); setSaving(false); setPasswordLoading(false); setLoading(true);
        clearTimeout(timer); timer = setTimeout(() => { if (mounted.current) void loadPreferences(); }, 0);
      } else if (event === 'SIGNED_IN' && authChanged.current) {
        clearTimeout(timer); timer = setTimeout(() => { if (mounted.current) void loadPreferences(); }, 0);
      }
    });
    return () => { mounted.current = false; retire(); subscription.unsubscribe(); clearTimeout(timer); };
  }, [loadPreferences, profile.user_id, retire]);
  const unavailable = loading || loadError || loadedFor !== scope || accountChanged;
  const changePreference = (key: keyof ClientNotificationPreferences, value: boolean | string) => {
    if (busy.current || !ready.current || unavailable) return;
    dirty.current = true; setFormError(''); setPrefs(p => ({ ...p, [key]: value }));
  };
  const togglePref = (key: typeof CLIENT_ALERT_KEYS[number]) => changePreference(key, !prefs[key]);
  const reload = () => {
    if (busy.current || loading) return;
    if (dirty.current && !confirm('Discard unsaved choices and reload saved preferences?')) return;
    void loadPreferences();
  };
  const savePrefs = async () => {
    if (busy.current || !ready.current || unavailable) return;
    busy.current = true;
    const token = ++operation.current, epoch = lifetime.current;
    const current = () => mounted.current && lifetime.current === epoch && operation.current === token && scopeRef.current === scope;
    setSaving(true); setFormError('');
    try {
      const saved = await saveClientNotificationPreferences(supabase, profile.id, profile.user_id, prefs, current);
      if (!current()) return;
      setPrefs(saved.preferences); setSnapshot(saved); dirty.current = false;
      onMessage('success', 'Notification preferences saved.');
    } catch (error) {
      if (current()) { const message = error instanceof ClientNotificationError ? error.message : 'The save could not be confirmed. Your choices are kept; retry.'; setFormError(message); onMessage('error', message); }
    } finally {
      if (operation.current === token) { busy.current = false; if (mounted.current && scopeRef.current === scope) setSaving(false); }
    }
  };
  const sendPasswordReset = async () => {
    if (passwordBusy.current || !mounted.current || accountChanged || scopeRef.current !== scope) return;
    passwordBusy.current = true;
    const epoch = lifetime.current;
    const current = () => mounted.current && lifetime.current === epoch && scopeRef.current === scope;
    setPasswordLoading(true);
    try {
      const auth = await supabase.auth.getUser();
      if (!current()) return;
      if (auth.error || auth.data?.user?.id !== profile.user_id || !auth.data.user.email) throw new Error('Unverified account');
      const { error } = await supabase.auth.resetPasswordForEmail(auth.data.user.email, { redirectTo: `${window.location.origin}/client/reset-password` });
      if (!current()) return;
      if (error) throw error;
      onMessage('success', 'Password reset link requested. Check your email.');
    } catch { if (current()) onMessage('error', 'The reset link request could not be confirmed. Please retry.'); }
    finally { if (current()) { passwordBusy.current = false; setPasswordLoading(false); } }
  };
  const effectiveHealth = { ...healthData, notificationsSet: !unavailable && snapshot?.exists === true, paymentMethodAdded: paymentMethodView(paymentMethodState).complete };
  const completedCount = Object.values(effectiveHealth).filter(Boolean).length;
  const totalCount = Object.values(effectiveHealth).length;
  const progress = Math.round((completedCount / totalCount) * 100);

  if (accountChanged) return <div role="alert">Your account changed. Reload your profile to manage preferences.<button type="button" onClick={() => void loadPreferences()} disabled={loading}>Retry loading preferences</button></div>;
  if (loadedFor !== null && loadedFor !== scope) return <div role="status">Loading notification preferences…</div>;
  return (
    <div>
      {/* Notification Preferences */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notification Preferences</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose which alerts you receive and how</p>
        <button type="button" onClick={reload} disabled={saving || loading} className="mb-4 text-teal-500 underline disabled:opacity-50">Reload saved preferences</button>
        {loading && <p role="status">Loading notification preferences…</p>}
        {loadError && <div role="alert" className="mb-4 text-red-500">Notification preferences could not be loaded. Please retry before making changes.<button type="button" onClick={() => void loadPreferences()} className="ml-3 underline">Retry loading preferences</button></div>}
        {formError && <p role="alert" className="mb-4 text-red-500">{formError}</p>}
        {!unavailable && <>
        {!snapshot?.exists && <p className="mb-4 text-sm text-slate-500">No saved preferences yet. These are defaults until you save.</p>}
        <fieldset disabled={saving}>

        <div className="space-y-3 mb-4">
          {NOTIF_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-[#111d35] rounded-lg flex items-center justify-center border border-slate-200 dark:border-[#1e2d4d]">
                  <i className={`${item.icon} text-teal-500 text-sm`}></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => togglePref(item.key)}
                role="switch" aria-label={item.label} aria-checked={prefs[item.key]}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  prefs[item.key] ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    prefs[item.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">In-App Alerts</p>
                <p className="text-xs text-slate-500">Show banners in the app</p>
              </div>
              <button
                type="button"
                onClick={() => togglePref("in_app_alerts")}
                role="switch" aria-label="In-App Alerts" aria-checked={prefs.in_app_alerts}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  prefs.in_app_alerts ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    prefs.in_app_alerts ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">SMS Notifications</p>
                <p className="text-xs text-slate-500">Your preference for urgent text alerts</p>
              </div>
              <button
                type="button"
                onClick={() => togglePref("sms_notifications")}
                role="switch" aria-label="SMS Notifications" aria-checked={prefs.sms_notifications}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  prefs.sms_notifications ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    prefs.sms_notifications ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p id="client-email-frequency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Frequency</p>
          <div role="group" aria-labelledby="client-email-frequency" className="flex flex-wrap gap-2">
            {["instant", "daily", "weekly", "none"].map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => changePreference("email_frequency", freq)}
                aria-pressed={prefs.email_frequency === freq}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  prefs.email_frequency === freq
                    ? "bg-teal-500 text-white"
                    : "bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e2d4d]"
                }`}
              >
                {freq === "instant" ? "Immediate" : freq === "none" ? "Off" : freq.charAt(0).toUpperCase() + freq.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-500">Preferences apply where the alert service supports them. Essential account and payment emails may still be sent. Saving does not verify email or SMS delivery.</p>
        <button
          onClick={savePrefs}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          {saving ? (
            <>
              <i className="ri-loader-4-line animate-spin w-4 h-4 flex items-center justify-center"></i>
              Saving...
            </>
          ) : (
            <>
              <i className="ri-save-line w-4 h-4 flex items-center justify-center"></i>
              Save Preferences
            </>
          )}
        </button>
        </fieldset></>}
      </div>

      {/* Security Settings */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Security</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Manage your account security</p>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Account Email</p>
                <p className="text-xs text-slate-500">{profile.email}</p>
              </div>
              <span className="text-xs text-slate-400">Cannot be changed</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Password</p>
                <p className="text-xs text-slate-500">Change your account password</p>
              </div>
              <button
                onClick={sendPasswordReset}
                disabled={passwordLoading}
                className="px-4 py-2 bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap border border-slate-200 dark:border-[#1e2d4d]"
              >
                {passwordLoading ? "Sending..." : "Change Password"}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] opacity-60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500">Add an extra layer of security</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Coming Soon
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] opacity-60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Active Sessions</p>
                <p className="text-xs text-slate-500">View and manage logged-in devices</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Health Checklist */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account Health</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Complete these steps to get the most from QuickGuard
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{progress}%</p>
            <p className="text-xs text-slate-500">{completedCount}/{totalCount} complete</p>
          </div>
        </div>

        <div className="h-2 bg-slate-100 dark:bg-[#162036] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-teal-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="space-y-2">
          {HEALTH_ITEMS.map((item) => {
            const done = effectiveHealth[item.key as keyof typeof effectiveHealth];
            return (
              <div
                key={item.key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  done
                    ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
                    : "bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d]"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    done
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-[#1e2d4d] text-slate-500"
                  }`}
                >
                  <i className={`${done ? "ri-check-line" : item.icon} text-sm`}></i>
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      done ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.key === 'notificationsSet' && <p className="text-xs text-slate-500">{loading ? 'Checking preferences…' : loadError ? 'Could not check preferences.' : snapshot?.exists ? 'Saved preferences confirmed.' : 'No saved preferences yet.'}</p>}
                  {item.key === 'paymentMethodAdded' && <PaymentMethodStatus state={paymentMethodState} onRefresh={onRefreshPaymentMethod} />}
                </div>
                {done && (
                  <span className="ml-auto text-xs font-semibold text-emerald-500">Complete</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
