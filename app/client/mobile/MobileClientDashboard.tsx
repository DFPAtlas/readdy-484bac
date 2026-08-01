'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MobileInstallPrompt from '@/components/MobileInstallPrompt';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Link from 'next/link';

interface ClientDetails {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  business_address: string;
  subscription_tier: string;
  subscription_status: string;
  subscription_plan: string | null;
  created_at: string;
  verification_status: string;
  profile_completed: boolean;
  total_jobs_posted: number;
  active_jobs: number;
  total_spent: number;
  client_service_tier: string;
  client_promo_tier: string;
  client_signup_number: number | null;
  founding_client_badge: boolean;
}

interface Job {
  id: string;
  job_title: string;
  venue_city: string;
  venue_name: string;
  start_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  status: string;
  number_of_guards: number;
  applications_count: number;
  assigned_guards: number;
}

interface Applicant {
  id: string;
  status: string;
  applied_at: string;
  guard: {
    full_name: string;
    years_experience: number;
    rating: number;
  };
  job: {
    job_title: string;
  };
}

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end_date: string | null;
}

const clientTabs = [
  { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
  { id: 'jobs', icon: 'ri-briefcase-line', activeIcon: 'ri-briefcase-fill', label: 'Jobs' },
  { id: 'guards', icon: 'ri-shield-user-line', activeIcon: 'ri-shield-user-fill', label: 'Guards' },
  { id: 'notifications', icon: 'ri-notification-3-line', activeIcon: 'ri-notification-3-fill', label: 'Notifications' },
  { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
];

export default function MobileClientDashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { subscribed } = usePushNotifications('client');

  const loadDashboard = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push('/client/login');
      return;
    }
    const uid = session.user.id;
    setUserId(uid);

    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (!clientData) {
      router.push('/client/complete-profile-wizard');
      return;
    }

    setClient(clientData as ClientDetails);

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*, job_applications(count), job_assignments(count)')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });

    const formattedJobs = (jobsData || []).map((job: any) => ({
      ...job,
      applications_count: (job.job_applications?.[0] as any)?.count || 0,
      assigned_guards: (job.job_assignments?.[0] as any)?.count || 0,
    }));
    setJobs(formattedJobs as Job[]);

    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    setSubscription(subData as SubscriptionInfo | null);

    const { data: appsData } = await supabase
      .from('job_applications')
      .select('id, status, applied_at, guard:guard_id (full_name, years_experience, rating), job:job_id (job_title)')
      .eq('client_id', clientData.id)
      .eq('status', 'pending')
      .order('applied_at', { ascending: false })
      .limit(20);
    setApplicants((appsData || []) as Applicant[]);

    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(notifData || []);

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!client?.id) return;
    const channels = [];
    channels.push(
      supabase
        .channel('client-mobile-jobs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `client_id=eq.${client.id}` }, () => loadDashboard())
        .subscribe()
    );
    channels.push(
      supabase
        .channel('client-mobile-apps')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_applications' }, () => loadDashboard())
        .subscribe()
    );
    channels.push(
      supabase
        .channel('client-mobile-notifs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => loadDashboard())
        .subscribe()
    );
    channels.push(
      supabase
        .channel('client-mobile-assignments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => loadDashboard())
        .subscribe()
    );
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [client?.id, userId, loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getJobStatusConfig = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
      pending: { label: 'Pending', color: 'text-slate-400', bg: 'bg-[#162036]', border: 'border-[#1e2d4d]' },
      awaiting_guard_selection: { label: 'Review Applicants', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      awaiting_payment: { label: 'Pay Now', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
      open: { label: 'Open', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
    };
    return map[status] || map.pending;
  };

  const getSubscriptionStatus = () => {
    if (!client) return null;
    const { subscription_status, subscription_plan, subscription_tier } = client;
    if (subscription_status === 'trialing') return { text: 'Free Trial', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' };
    if (subscription_status === 'active') return { text: subscription_plan || subscription_tier || 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (subscription_status === 'cancelled') return { text: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (subscription_status === 'past_due') return { text: 'Past Due', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { text: 'Inactive', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
  };

  const activeJobs = jobs.filter(j => ['pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress', 'open'].includes(j.status));
  const needsActionJobs = jobs.filter(j => ['awaiting_guard_selection', 'awaiting_payment'].includes(j.status));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!client) return null;

  const subStatus = getSubscriptionStatus();
  const profilePercent = client.profile_completed ? 100 : 75;
  const unreadNotifs = notifications.filter((n: any) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#0B1933] pb-24">
      <MobileInstallPrompt role="client" />
      <PushNotificationPrompt role="client" />
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-4 pt-10 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-shield-check-line text-white text-lg"></i>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Client Portal</p>
              <h1 className="text-white font-bold text-lg leading-tight">{client?.company_name || client?.contact_name || 'Client'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {subscribed && (
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center" title="Push notifications enabled">
                <i className="ri-notification-3-line text-white text-sm"></i>
              </div>
            )}
            <button onClick={handleRefresh} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center cursor-pointer">
              <i className={`ri-refresh-line text-white text-xl ${refreshing ? 'animate-spin' : ''}`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Quick Action Tiles */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Post Job', icon: 'ri-add-circle-line', color: 'bg-teal-500', href: '/client/mobile/post-job' },
                { label: 'Active Jobs', icon: 'ri-briefcase-4-line', color: 'bg-blue-500', href: '/client/jobs' },
                { label: 'Review Guards', icon: 'ri-shield-user-line', color: 'bg-emerald-500', href: '/client/jobs' },
                { label: 'Payments', icon: 'ri-wallet-3-line', color: 'bg-violet-500', href: '/client/payment-history' },
                { label: 'Messages', icon: 'ri-message-3-line', color: 'bg-sky-500', href: '/client/messages' },
                { label: 'Support', icon: 'ri-customer-service-2-line', color: 'bg-amber-500', href: '/client/support' },
              ].map((tile) => (
                <Link key={tile.label} href={tile.href} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#111d35] border border-[#1e2d4d] cursor-pointer active:scale-95 transition-transform">
                  <div className={`w-10 h-10 ${tile.color} rounded-lg flex items-center justify-center`}>
                    <i className={`${tile.icon} text-white text-lg`}></i>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 text-center leading-tight">{tile.label}</span>
                </Link>
              ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-briefcase-4-line text-blue-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{client?.total_jobs_posted || 0}</p>
                <p className="text-xs text-slate-500">Total Jobs</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-shield-user-line text-emerald-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{activeJobs.length}</p>
                <p className="text-xs text-slate-500">Active Jobs</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="w-8 h-8 bg-violet-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-wallet-3-line text-violet-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">£{client?.total_spent ? Number(client.total_spent).toFixed(2) : '0.00'}</p>
                <p className="text-xs text-slate-500">Total Spent</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-user-received-line text-amber-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{applicants.length}</p>
                <p className="text-xs text-slate-500">New Applicants</p>
              </div>
            </div>

            {/* Status Cards */}
            <div className="space-y-3">
              {/* Profile Completion */}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <i className="ri-user-settings-line text-blue-400 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Profile {profilePercent}%</p>
                      <p className="text-xs text-slate-500">Completion</p>
                    </div>
                  </div>
                  <Link href="/client/profile" className="text-xs text-teal-400 font-medium cursor-pointer">
                    Edit
                  </Link>
                </div>
                <div className="h-2 bg-[#162036] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${profilePercent}%` }}></div>
                </div>
              </div>

              {/* Subscription Status */}
              {subStatus && (
                <div className={`bg-[#111d35] rounded-xl border ${subStatus.border} p-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${subStatus.bg} rounded-lg flex items-center justify-center`}>
                      <i className="ri-vip-crown-line text-xl"></i>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${subStatus.color}`}>{subStatus.text}</p>
                      <p className="text-xs text-slate-500">Subscription</p>
                    </div>
                  </div>
                  <Link href="/pricing" className="text-xs text-teal-400 font-medium cursor-pointer">
                    Manage
                  </Link>
                </div>
              )}

              {/* Needs Action */}
              {needsActionJobs.length > 0 && (
                <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center">
                      <i className="ri-error-warning-line text-amber-400 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-300">{needsActionJobs.length} job{needsActionJobs.length > 1 ? 's' : ''} need action</p>
                      <p className="text-xs text-amber-400/70">Review applicants or complete payment</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {needsActionJobs.slice(0, 2).map(job => (
                      <Link key={job.id} href={`/client/jobs/${job.id}`} className="block bg-[#162036] rounded-lg p-3 border border-[#1e2d4d] cursor-pointer">
                        <p className="text-sm font-semibold text-white">{job.job_title}</p>
                        <p className="text-xs text-slate-500">
                          {job.status === 'awaiting_guard_selection' ? `${job.applications_count} applicants` : 'Payment required'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* JOBS TAB */}
        {activeTab === 'jobs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">My Jobs</h2>
              <Link href="/client/mobile/post-job" className="text-xs text-teal-400 font-medium cursor-pointer">
                + New Job
              </Link>
            </div>
            {jobs.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <i className="ri-briefcase-line text-4xl text-slate-600 mb-3"></i>
                <p className="text-sm text-slate-500">No jobs posted yet</p>
                <Link href="/client/mobile/post-job" className="inline-block mt-3 bg-teal-500 text-slate-900 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
                  Post First Job
                </Link>
              </div>
            ) : (
              jobs.map(job => {
                const cfg = getJobStatusConfig(job.status);
                return (
                  <Link key={job.id} href={`/client/jobs/${job.id}`} className="block bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">{job.job_title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>
                        {job.venue_city}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line"></i>
                        {new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <i className="ri-user-received-line"></i>
                          {job.applications_count} applied
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-user-follow-line"></i>
                          {job.assigned_guards} assigned
                        </span>
                      </div>
                      <p className="text-sm font-bold text-teal-400">£{job.hourly_rate}/hr</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* GUARDS TAB */}
        {activeTab === 'guards' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white mb-2">Applicants</h2>
            {applicants.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center mb-4">
                <i className="ri-user-received-line text-4xl text-slate-600 mb-3"></i>
                <p className="text-sm text-slate-500">No new applicants</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {applicants.map(app => (
                  <div key={app.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-teal-500/15 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-teal-400">
                          {(app.guard?.full_name || 'GU').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{app.guard?.full_name || 'Guard'}</p>
                        <p className="text-xs text-slate-500">{app.guard?.years_experience || 0} years exp</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {app.guard?.rating && (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <i className="ri-star-fill"></i>
                            {app.guard.rating.toFixed(1)}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">{app.job?.job_title}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-lg font-bold text-white mb-2">Booked Guards</h2>
            {jobs.filter(j => j.assigned_guards > 0).length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <i className="ri-shield-user-line text-4xl text-slate-600 mb-3"></i>
                <p className="text-sm text-slate-500">No guards booked yet</p>
              </div>
            ) : (
              jobs.filter(j => j.assigned_guards > 0).map(job => (
                <Link key={job.id} href={`/client/jobs/${job.id}`} className="block bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 cursor-pointer mb-3">
                  <p className="text-sm font-semibold text-white mb-1">{job.job_title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <i className="ri-user-follow-line"></i>
                      {job.assigned_guards} assigned
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      {new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadNotifs > 0 && (
                  <button
                    onClick={async () => {
                      const unreadIds = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
                      if (unreadIds.length > 0) {
                        await supabase.from('notifications').update({ is_read: true, read: true }).in('id', unreadIds);
                        loadDashboard();
                      }
                    }}
                    className="text-xs text-teal-400 font-medium cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>
            </div>
            <Link href="/client/notifications" className="block bg-teal-500 rounded-xl p-4 text-center cursor-pointer">
              <div className="w-12 h-12 bg-slate-900/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <i className="ri-notification-3-line text-2xl text-slate-900"></i>
              </div>
              <p className="text-base font-bold text-slate-900">View All Notifications</p>
              <p className="text-xs text-slate-700 mt-0.5">Full history and filters</p>
            </Link>
            <Link href="/client/messages" className="block bg-[#111d35] rounded-xl p-4 text-center border border-[#1e2d4d] cursor-pointer">
              <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-2">
                <i className="ri-message-3-line text-2xl text-teal-400"></i>
              </div>
              <p className="text-base font-bold text-white">Messages</p>
              <p className="text-xs text-slate-500 mt-0.5">Chat with guards and support</p>
            </Link>
            {notifications.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <i className="ri-notification-off-line text-4xl text-slate-600 mb-3"></i>
                <p className="text-sm text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-600 mt-1">You are all caught up!</p>
              </div>
            ) : (
              notifications.map((n: any) => {
                const priorityConfig: Record<string, { color: string; border: string; badge: string }> = {
                  '3': { color: 'text-red-400', border: 'border-red-500/30', badge: 'bg-red-500/15 text-red-400' },
                  '2': { color: 'text-amber-400', border: 'border-amber-500/30', badge: 'bg-amber-500/15 text-amber-400' },
                  '1': { color: 'text-blue-400', border: 'border-blue-500/30', badge: 'bg-blue-500/15 text-blue-400' },
                  '0': { color: 'text-slate-400', border: 'border-slate-500/30', badge: 'bg-slate-500/15 text-slate-400' },
                };
                const cfg = priorityConfig[String(n.priority || '1')] || priorityConfig['1'];
                const icons: Record<string, string> = {
                  job_update: 'ri-briefcase-line',
                  payment: 'ri-wallet-3-line',
                  guard_assigned: 'ri-shield-user-line',
                  complaint: 'ri-feedback-line',
                  subscription: 'ri-vip-crown-line',
                  message: 'ri-message-3-line',
                  support_ticket: 'ri-customer-service-2-line',
                  new_applicants: 'ri-user-add-line',
                  guard_selection: 'ri-user-follow-line',
                  guard_confirmation: 'ri-shield-check-line',
                  payment_alert: 'ri-wallet-3-line',
                  account_billing: 'ri-vip-crown-line',
                };
                const icon = icons[n.category || n.type] || 'ri-notification-3-line';
                return (
                  <div
                    key={n.id}
                    className={`bg-[#111d35] rounded-xl border ${!n.is_read ? cfg.border : 'border-[#1e2d4d]'} p-4`}
                    onClick={async () => {
                      if (!n.is_read) {
                        await supabase.from('notifications').update({ is_read: true, read: true }).eq('id', n.id);
                        loadDashboard();
                      }
                      if (n.link) {
                        router.push(n.link);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-[#162036] rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className={`${icon} text-slate-400 text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold ${n.is_read ? 'text-slate-400' : 'text-white'}`}>{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 bg-teal-400 rounded-full flex-shrink-0 mt-1"></span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                            {n.priority === 3 ? 'Urgent' : n.priority === 2 ? 'Important' : n.priority === 1 ? 'Normal' : 'Info'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-slate-500 mt-1.5">{new Date(n.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-white">
                  {(client?.company_name || 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{client?.company_name || client?.contact_name || 'Client'}</h2>
              <p className="text-xs text-slate-500">{client?.email}</p>
              {client?.founding_client_badge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-400/30 bg-amber-500/15 text-amber-400 mt-2">
                  <i className="ri-shield-star-line"></i>
                  Founding Client
                </span>
              )}
            </div>

            {/* Menu Links */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
              <Link href="/client/profile" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-teal-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-user-settings-line text-teal-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-white">Edit Profile</span>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/client/jobs/tracker" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-radar-line text-blue-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-white">Job Tracker</span>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/client/payment-history" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-receipt-line text-violet-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-white">Invoices & Payments</span>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/client/notifications" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-notification-3-line text-amber-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-white">Notifications</span>
                  {unreadNotifs > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadNotifs}
                    </span>
                  )}
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/client/support" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-teal-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-customer-service-2-line text-teal-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-white">Support Centre</span>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between px-4 py-4 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-logout-box-r-line text-red-400 text-lg"></i>
                  </div>
                  <span className="text-sm text-red-400">Sign Out</span>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Switch to Full Dashboard */}
      <div className="px-4 pb-2">
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-computer-line text-slate-500 text-sm"></i>
            <p className="text-xs text-slate-500">On desktop?</p>
          </div>
          <Link href="/client/dashboard" className="text-xs text-teal-400 font-semibold cursor-pointer">
            Full Dashboard →
          </Link>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111d35] border-t border-[#1e2d4d] px-2 pb-5 pt-2 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {clientTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const hasBadge = tab.id === 'notifications' && unreadNotifs > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center gap-1 px-3 py-1 cursor-pointer"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`${isActive ? tab.activeIcon : tab.icon} text-xl ${isActive ? 'text-teal-400' : 'text-slate-500'}`}></i>
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-teal-400' : 'text-slate-500'}`}>{tab.label}</span>
                {hasBadge && (
                  <span className="absolute -top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}