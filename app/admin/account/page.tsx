'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { supabase } from '@/lib/supabase';
import { useAdminAuth, clearAdminAuthCache } from '@/hooks/useAdminAuth';

export default function AdminAccountPage() {
  const router = useSafeRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [emailForm, setEmailForm] = useState({ newEmail: '', confirmEmail: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const adminAuth = useAdminAuth();

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!adminAuth.email) {
        router.push('/admin/login');
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-account-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: adminAuth.email, action: 'get_profile' }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setLoading(false);
        return;
      }

      setAdminUser({ ...data.admin, email: adminAuth.email });
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus(null);

    if (emailForm.newEmail !== emailForm.confirmEmail) {
      setEmailStatus({ type: 'error', message: 'Email addresses do not match.' });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: emailForm.newEmail });
      if (error) throw error;

      setEmailStatus({ type: 'success', message: 'A confirmation link has been sent to your new email. Please verify it to complete the change.' });
      setEmailForm({ newEmail: '', confirmEmail: '' });
    } catch (err: any) {
      setEmailStatus({ type: 'error', message: err.message || 'Failed to update email.' });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (passwordForm.newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    if (!adminAuth.email) {
      setPasswordStatus({ type: 'error', message: 'Session expired. Please log in again.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: adminAuth.email, newPassword: passwordForm.newPassword }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleLogout() {
    clearAdminAuthCache();
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#111d35] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#1a2b4a]">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-error-warning-line text-3xl text-slate-400"></i>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Could not load profile</h2>
          <p className="text-slate-400 text-sm mb-6">Something went wrong loading your account details.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-2"></i>Try Again
          </button>
          <div className="mt-4">
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-300 underline cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin/accounts', icon: 'ri-user-line', label: 'Accounts' },
    { href: '/admin/jobs', icon: 'ri-briefcase-line', label: 'Jobs' },
    { href: '/admin/payments', icon: 'ri-money-dollar-circle-line', label: 'Payments' },
    { href: '/admin/guard-verifications', icon: 'ri-shield-check-line', label: 'Verifications' },
    { href: '/admin/subscribers', icon: 'ri-mail-line', label: 'Subscribers' },
    { href: '/admin/account', icon: 'ri-settings-3-line', label: 'My Account' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/50">
                <i className="ri-admin-line text-xl"></i>
              </div>
              <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-logout-box-line"></i>
              </div>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#1a2b4a] bg-[#0d1a30]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <nav className="flex space-x-1 h-12 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = item.href === '/admin/account';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 text-sm font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-teal-400 border-teal-400'
                      : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={item.icon}></i>
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">

        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-teal-600/10 rounded-full border border-teal-600/30">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-admin-line text-3xl text-teal-400"></i>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{adminUser?.full_name || 'Admin'}</h2>
              <p className="text-sm text-slate-400">{adminUser?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-teal-600/10 text-teal-400 rounded-full capitalize border border-teal-600/30">
                {adminUser?.role?.replace('_', ' ') || 'Admin'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 flex items-center justify-center bg-indigo-600/10 rounded-lg border border-indigo-600/30">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-mail-settings-line text-lg text-indigo-400"></i>
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Update Email Address</h3>
              <p className="text-xs text-slate-400">Current: {adminUser?.email}</p>
            </div>
          </div>

          {emailStatus && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${
              emailStatus.type === 'success'
                ? 'bg-emerald-600/10 border border-emerald-600/30 text-emerald-300'
                : 'bg-red-600/10 border border-red-600/30 text-red-300'
            }`}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5 shrink-0">
                <i className={emailStatus.type === 'success' ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-error-warning-line text-red-400'}></i>
              </div>
              {emailStatus.message}
            </div>
          )}

          <form onSubmit={handleEmailUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Email Address</label>
              <input
                type="email"
                required
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                className="w-full px-4 py-2 text-sm bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="new@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Email</label>
              <input
                type="email"
                required
                value={emailForm.confirmEmail}
                onChange={(e) => setEmailForm({ ...emailForm, confirmEmail: e.target.value })}
                className="w-full px-4 py-2 text-sm bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="Repeat new email"
              />
            </div>
            <button
              type="submit"
              disabled={emailLoading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {emailLoading ? 'Updating...' : 'Update Email'}
            </button>
          </form>
        </div>

        <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 flex items-center justify-center bg-emerald-600/10 rounded-lg border border-emerald-600/30">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-lock-password-line text-lg text-emerald-400"></i>
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Change Password</h3>
              <p className="text-xs text-slate-400">Use a strong password with at least 8 characters</p>
            </div>
          </div>

          {passwordStatus && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${
              passwordStatus.type === 'success'
                ? 'bg-emerald-600/10 border border-emerald-600/30 text-emerald-300'
                : 'bg-red-600/10 border border-red-600/30 text-red-300'
            }`}>
              <div className="w-5 h-5 flex items-center justify-center mt-0.5 shrink-0">
                <i className={passwordStatus.type === 'success' ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-error-warning-line text-red-400'}></i>
              </div>
              {passwordStatus.message}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-10 text-sm bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Min. 8 characters"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-300 cursor-pointer">
                  <i className={showNewPw ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-10 text-sm bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Repeat new password"
                />
                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-300 cursor-pointer">
                  <i className={showConfirmPw ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {passwordLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}