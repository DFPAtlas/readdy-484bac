"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface NotificationPrefs {
  new_applicants: boolean;
  guard_confirmations: boolean;
  payment_updates: boolean;
  job_reminders: boolean;
  support_tickets: boolean;
  messages: boolean;
  in_app_alerts: boolean;
  sms_notifications: boolean;
  email_frequency: string;
}

interface HealthData {
  profileComplete: boolean;
  billingAdded: boolean;
  firstJobPosted: boolean;
  paymentMethodAdded: boolean;
  notificationsSet: boolean;
  documentsUploaded: boolean;
}

interface Profile {
  user_id: string;
  email: string;
}

interface Props {
  profile: Profile;
  notifPrefs: NotificationPrefs | null;
  healthData: HealthData;
  onRefreshPrefs: () => void;
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

export default function PreferencesSection({ profile, notifPrefs, healthData, onRefreshPrefs, onMessage }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    notifPrefs || {
      new_applicants: true,
      guard_confirmations: true,
      payment_updates: true,
      job_reminders: true,
      support_tickets: true,
      messages: true,
      in_app_alerts: true,
      sms_notifications: false,
      email_frequency: "immediate",
    }
  );
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const savePrefs = async () => {
    setSaving(true);
    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("id")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    let error;
    if (existing) {
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update({
          new_applicants: prefs.new_applicants,
          guard_confirmations: prefs.guard_confirmations,
          payment_updates: prefs.payment_updates,
          job_reminders: prefs.job_reminders,
          support_tickets: prefs.support_tickets,
          messages: prefs.messages,
          in_app_alerts: prefs.in_app_alerts,
          sms_notifications: prefs.sms_notifications,
          email_frequency: prefs.email_frequency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("notification_preferences").insert({
        user_id: profile.user_id,
        new_applicants: prefs.new_applicants,
        guard_confirmations: prefs.guard_confirmations,
        payment_updates: prefs.payment_updates,
        job_reminders: prefs.job_reminders,
        support_tickets: prefs.support_tickets,
        messages: prefs.messages,
        in_app_alerts: prefs.in_app_alerts,
        sms_notifications: prefs.sms_notifications,
        email_frequency: prefs.email_frequency,
      });
      error = insertError;
    }

    setSaving(false);
    if (error) {
      onMessage("error", "Failed to save preferences.");
      return;
    }
    onMessage("success", "Notification preferences saved.");
    onRefreshPrefs();
  };

  const sendPasswordReset = async () => {
    setPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/client/reset-password`,
    });
    setPasswordLoading(false);
    if (error) {
      onMessage("error", "Failed to send reset link.");
      return;
    }
    onMessage("success", "Password reset link sent to your email.");
  };

  const completedCount = Object.values(healthData).filter(Boolean).length;
  const totalCount = Object.values(healthData).length;
  const progress = Math.round((completedCount / totalCount) * 100);

  return (
    <div>
      {/* Notification Preferences */}
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notification Preferences</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose which alerts you receive and how</p>

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
                <p className="text-xs text-slate-500">Text messages for urgent alerts</p>
              </div>
              <button
                type="button"
                onClick={() => togglePref("sms_notifications")}
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Frequency</label>
          <div className="flex gap-2">
            {["immediate", "daily", "weekly"].map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, email_frequency: freq }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  prefs.email_frequency === freq
                    ? "bg-teal-500 text-white"
                    : "bg-slate-100 dark:bg-[#162036] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e2d4d]"
                }`}
              >
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </button>
            ))}
          </div>
        </div>

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
            const done = healthData[item.key as keyof HealthData];
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
                <p
                  className={`text-sm font-medium ${
                    done ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {item.label}
                </p>
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