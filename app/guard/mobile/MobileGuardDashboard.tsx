"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileInstallPrompt from '@/components/MobileInstallPrompt';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import BottomNav from './BottomNav';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';
import HomeSkeleton from './HomeSkeleton';
import JobsSkeleton from './JobsSkeleton';
import ShiftsSkeleton from './ShiftsSkeleton';
import MessagesSkeleton from './MessagesSkeleton';

interface Guard {
  id: string;
  full_name: string;
  email: string;
  profile_image_url: string | null;
  location: string | null;
  postcode: string | null;
  years_experience: number | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  total_earnings: number | null;
  verification_status: string | null;
  profile_completed: boolean | null;
  subscription_status: string | null;
  sia_licence_front_url: string | null;
  sia_expiry_date: string | null;
  subscription_plan: string | null;
  subscription_tier: string | null;
  sia_licence_number: string | null;
  sia_licence_type: string | null;
  mobile_number: string | null;
  dbs_certificate_url: string | null;
  first_aid_certificate_url: string | null;
}

interface JobAssignment {
  id: string;
  status: string;
  payment_amount: number | null;
  payment_status: string | null;
  assigned_at: string;
  jobs: {
    id: string;
    job_title: string;
    location: string;
    postcode: string;
    start_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
  };
}

interface JobApplication {
  id: string;
  status: string;
  applied_at: string;
  jobs: {
    id: string;
    job_title: string;
    location: string;
    postcode: string;
    start_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    clients: {
      company_name: string;
    };
  };
}

interface ClientResponse {
  id: string;
  response_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  jobs: {
    job_title: string;
  };
  clients: {
    company_name: string;
  };
}

interface AvailableJob {
  id: string;
  job_title: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  status: string;
  clients: {
    company_name: string;
  };
  licence_required: string | null;
  number_of_guards: number | null;
}

interface BankDetail {
  id: string;
  guard_id: string;
  account_holder_name: string | null;
  sort_code: string | null;
  account_number: string | null;
  bank_name: string | null;
}

interface EarningsSummary {
  totalEarned: number;
  totalPending: number;
  totalPaid: number;
  completedJobs: number;
}

const guardTabs = [
  { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
  { id: 'jobs', icon: 'ri-briefcase-line', activeIcon: 'ri-briefcase-fill', label: 'Jobs' },
  { id: 'shifts', icon: 'ri-calendar-line', activeIcon: 'ri-calendar-fill', label: 'Shifts' },
  { id: 'messages', icon: 'ri-message-3-line', activeIcon: 'ri-message-3-fill', label: 'Messages' },
  { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
];

export default function MobileGuardDashboard() {
  const router = useRouter();
  const [guard, setGuard] = useState<Guard | null>(null);
  const [guardUserId, setGuardUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<JobAssignment[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [responses, setResponses] = useState<ClientResponse[]>([]);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right');
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetail | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary>({ totalEarned: 0, totalPending: 0, totalPaid: 0, completedJobs: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [tabContentVisible, setTabContentVisible] = useState(true);
  const { subscribed } = usePushNotifications('guard');
  const touchStartY = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabOrder = ['home', 'jobs', 'shifts', 'messages', 'profile'];

  const loadDashboardData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push('/guard/login');
      return;
    }
    const userId = session.user.id;
    setGuardUserId(userId);

    const { data: guardData } = await supabase
      .from('guards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!guardData) {
      router.push('/guard/complete-profile-wizard');
      return;
    }

    if (guardData.verification_status === 'rejected') {
      router.push('/guard/verification-failed');
      return;
    }
    if (guardData.verification_status !== 'approved' && guardData.verification_status !== 'verified') {
      router.push('/guard/onboarding');
      return;
    }

    setGuard(guardData as Guard);

    const today = new Date().toISOString().split('T')[0];

    const { data: assignmentsData } = await supabase
      .from('job_assignments')
      .select('id, status, payment_amount, payment_status, assigned_at, jobs!inner (id, job_title, location, postcode, start_date, start_time, end_time, hourly_rate)')
      .eq('guard_id', guardData.id)
      .in('status', ['confirmed', 'in_progress', 'accepted'])
      .order('assigned_at', { ascending: false });

    const allAssignments = (assignmentsData || []) as JobAssignment[];
    setAssignments(allAssignments);

    const upcoming = allAssignments
      .filter(a => (a.status === 'confirmed' || a.status === 'accepted') && (a.jobs as any)?.start_date >= today)
      .sort((a, b) => ((a.jobs as any)?.start_date || '').localeCompare((b.jobs as any)?.start_date || ''));
    setUpcomingJobs(upcoming);

    const { data: appsData } = await supabase
      .from('job_applications')
      .select('id, status, applied_at, jobs!inner (id, job_title, location, postcode, start_date, start_time, end_time, hourly_rate, clients (company_name))')
      .eq('guard_id', guardData.id)
      .order('applied_at', { ascending: false });
    setApplications((appsData || []) as JobApplication[]);

    const { data: responsesData } = await supabase
      .from('client_responses')
      .select('id, response_type, message, is_read, created_at, jobs (job_title), clients (company_name)')
      .eq('guard_id', guardData.id)
      .order('created_at', { ascending: false });
    setResponses((responsesData || []) as ClientResponse[]);
    setUnreadCount((responsesData || []).filter((r: any) => !r.is_read).length);

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id, job_title, venue_city, venue_postcode, start_date, start_time, end_time, hourly_rate, status, clients (company_name), licence_required, number_of_guards')
      .eq('status', 'open')
      .eq('is_deleted', false)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(30);
    setAvailableJobs((jobsData || []) as AvailableJob[]);

    const { data: bankData } = await supabase
      .from('guard_bank_details')
      .select('*')
      .eq('guard_id', guardData.id)
      .maybeSingle();
    setBankDetails(bankData as BankDetail | null);

    const { data: payoutsData } = await supabase
      .from('guard_payouts')
      .select('amount, status')
      .eq('guard_id', guardData.id);
    const payouts = payoutsData || [];
    const totalEarned = payouts.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalPending = payouts.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalPaid = payouts.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const completedJobs = allAssignments.filter(a => a.status === 'completed').length;
    setEarnings({ totalEarned, totalPending, totalPaid, completedJobs });

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!guard?.id) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    channels.push(supabase.channel('guard-mobile-jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadDashboardData()).subscribe());
    channels.push(supabase.channel('guard-mobile-responses').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_responses', filter: `guard_id=eq.${guard.id}` }, () => loadDashboardData()).subscribe());
    channels.push(supabase.channel('guard-mobile-assignments').on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments', filter: `guard_id=eq.${guard.id}` }, () => loadDashboardData()).subscribe());
    channels.push(supabase.channel('guard-mobile-apps').on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `guard_id=eq.${guard.id}` }, () => loadDashboardData()).subscribe());
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [guard?.id, loadDashboardData]);

  const handleTabChange = (tabId: string) => {
    const currentIdx = tabOrder.indexOf(activeTab);
    const newIdx = tabOrder.indexOf(tabId);
    setTabDirection(newIdx > currentIdx ? 'right' : 'left');
    setTabContentVisible(false);
    setTimeout(() => {
      setActiveTab(tabId);
      setTabContentVisible(true);
    }, 150);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleApplyToJob = async (jobId: string) => {
    if (!guard) return;
    setApplyingTo(jobId);
    try {
      const limitCheck = await checkGuardApplicationLimit(supabase, guard.id);
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'limit_reached') {
          alert('You have reached your monthly application limit for your current plan. Upgrade your plan to apply for more jobs this month.');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else {
          alert('We could not verify your guard subscription plan. Please refresh or contact support.');
          router.push('/upgrade?reason=guard.plan_verification_failed');
        }
        setApplyingTo(null);
        return;
      }

      const { error } = await supabase
        .from('job_applications')
        .insert([{ job_id: jobId, guard_id: guard.id, status: 'pending' }]);
      if (error) throw error;
      await loadDashboardData();
    } catch (error: any) {
      if (error.code === '23505') {
        alert('You have already applied to this job.');
      } else {
        alert('Failed to apply. Please try again.');
      }
    } finally {
      setApplyingTo(null);
    }
  };

  const handleMarkAsRead = async (responseId: string) => {
    try {
      await supabase.from('client_responses').update({ is_read: true }).eq('id', responseId);
      setResponses(prev => prev.map(r => r.id === responseId ? { ...r, is_read: true } : r));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleCheckIn = async (assignmentId: string) => {
    try {
      await supabase.from('job_assignments').update({ status: 'in_progress', checked_in_at: new Date().toISOString() }).eq('id', assignmentId);
      await loadDashboardData();
    } catch {
      alert('Failed to check in. Please try again.');
    }
  };

  const handleCheckOut = async (assignmentId: string) => {
    try {
      await supabase.from('job_assignments').update({ status: 'completed', checked_out_at: new Date().toISOString() }).eq('id', assignmentId);
      await loadDashboardData();
    } catch {
      alert('Failed to check out. Please try again.');
    }
  };

  const handlePullRefresh = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && e.touches[0].clientY > touchStartY.current + 60) {
      handleRefresh();
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      under_review: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
      accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
      confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
      completed: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    };
    return map[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  };

  const getResponseIcon = (type: string) => {
    const map: Record<string, string> = {
      interview_request: 'ri-calendar-line',
      job_offer: 'ri-gift-line',
      rejection: 'ri-close-circle-line',
      question: 'ri-question-line',
      message: 'ri-message-3-line',
    };
    return map[type] || 'ri-mail-line';
  };

  const getResponseColor = (type: string) => {
    const map: Record<string, string> = {
      interview_request: 'text-blue-400',
      job_offer: 'text-emerald-400',
      rejection: 'text-red-400',
      question: 'text-amber-400',
      message: 'text-teal-400',
    };
    return map[type] || 'text-slate-400';
  };

  const getSIAStatus = () => {
    if (!guard) return null;
    const { verification_status, sia_licence_front_url, sia_expiry_date } = guard;
    if ((verification_status === 'approved' || verification_status === 'verified') && sia_licence_front_url) {
      if (sia_expiry_date) {
        const days = Math.floor((new Date(sia_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return { type: 'expired', text: 'SIA Expired', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'ri-alert-line' };
        if (days <= 60) return { type: 'warning', text: `Expires in ${days}d`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'ri-time-line' };
      }
      return { type: 'ok', text: 'SIA Verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'ri-shield-check-line' };
    }
    if (verification_status === 'pending') return { type: 'pending', text: 'SIA Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'ri-loader-4-line' };
    if (verification_status === 'rejected') return { type: 'rejected', text: 'SIA Rejected', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'ri-close-circle-line' };
    return { type: 'missing', text: 'SIA Missing', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: 'ri-shield-line' };
  };

  const getSubscriptionStatus = () => {
    if (!guard) return null;
    const { subscription_status, subscription_plan, subscription_tier } = guard;
    if (subscription_status === 'trialing') return { text: 'Free Trial', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: 'ri-vip-crown-line' };
    if (subscription_status === 'active') return { text: subscription_plan || subscription_tier || 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'ri-vip-crown-line' };
    if (subscription_status === 'cancelled') return { text: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'ri-close-circle-line' };
    if (subscription_status === 'past_due') return { text: 'Past Due', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'ri-time-line' };
    return { text: 'Inactive', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: 'ri-vip-crown-line' };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(Number(h), Number(m));
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getProfilePercent = () => {
    if (!guard) return 0;
    let score = 0;
    const fields = [
      guard.full_name, guard.email, guard.mobile_number, guard.location,
      guard.postcode, guard.years_experience, guard.sia_licence_number,
      guard.sia_licence_type, guard.sia_licence_front_url, guard.dbs_certificate_url,
      guard.first_aid_certificate_url, guard.profile_image_url
    ];
    score = fields.filter(Boolean).length;
    return Math.round((score / fields.length) * 100);
  };

  const getActionItems = () => {
    const items = [];
    if (!guard) return items;
    const profilePercent = getProfilePercent();
    if (profilePercent < 100) {
      items.push({ id: 'profile', icon: 'ri-user-settings-line', text: 'Complete your profile', subtext: `${profilePercent}% done`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', action: '/guard/profile' });
    }
    const sia = getSIAStatus();
    if (sia?.type === 'missing') {
      items.push({ id: 'sia', icon: 'ri-shield-line', text: 'Upload SIA licence', subtext: 'Required to work', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', action: '/guard/profile' });
    } else if (sia?.type === 'expired') {
      items.push({ id: 'sia', icon: 'ri-alert-line', text: 'SIA licence expired', subtext: 'Update immediately', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', action: '/guard/profile' });
    } else if (sia?.type === 'warning') {
      items.push({ id: 'sia', icon: 'ri-time-line', text: 'SIA expiring soon', subtext: sia.text, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', action: '/guard/profile' });
    }
    const unconfirmed = assignments.filter(a => a.status === 'accepted');
    if (unconfirmed.length > 0) {
      items.push({ id: 'confirm', icon: 'ri-calendar-check-line', text: `${unconfirmed.length} job${unconfirmed.length > 1 ? 's' : ''} to confirm`, subtext: 'Tap to view', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', action: '/guard/dashboard' });
    }
    if (todaysJobs.length > 0) {
      const needsCheckIn = todaysJobs.filter(j => j.status === 'confirmed');
      if (needsCheckIn.length > 0) {
        items.push({ id: 'checkin', icon: 'ri-login-box-line', text: `${needsCheckIn.length} shift${needsCheckIn.length > 1 ? 's' : ''} today`, subtext: 'Ready to check in', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', action: '/guard/mobile' });
      }
    }
    if (unreadCount > 0) {
      items.push({ id: 'messages', icon: 'ri-message-3-line', text: `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`, subtext: 'Tap to read', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', action: '/guard/mobile' });
    }
    if (!bankDetails) {
      items.push({ id: 'bank', icon: 'ri-bank-card-line', text: 'Add bank details', subtext: 'To get paid', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', action: '/guard/bank-settings' });
    }
    return items;
  };

  const filteredJobs = availableJobs.filter(job => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return job.job_title.toLowerCase().includes(q) || job.venue_city.toLowerCase().includes(q) || (job.clients?.company_name || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col">
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-4 pt-10 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-shield-check-line text-white text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Guard Portal</p>
                <div className="w-24 h-5 bg-white/20 rounded mt-1" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 px-4 py-4">
          <HomeSkeleton />
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-[#0F1A2E]/95 border-t border-[#1e2d4d]/60 px-2 pb-[env(safe-area-inset-bottom)] pt-2 z-50">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {guardTabs.map((tab) => (
              <div key={tab.id} className="flex flex-col items-center gap-1 px-3 py-1">
                <div className="w-10 h-10 flex items-center justify-center rounded-2xl">
                  <i className={`${tab.icon} text-xl text-slate-500`} />
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{tab.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!guard) return null;

  const siaStatus = getSIAStatus();
  const subStatus = getSubscriptionStatus();
  const profilePercent = getProfilePercent();
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysJobs = upcomingJobs.filter(j => (j.jobs as any)?.start_date === todayStr);
  const actionItems = getActionItems();
  const appCounts = {
    applied: applications.filter(a => a.status === 'pending').length,
    shortlisted: applications.filter(a => a.status === 'shortlisted').length,
    selected: applications.filter(a => a.status === 'selected').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    confirmed: applications.filter(a => a.status === 'confirmed').length,
  };

  const tabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className={`space-y-4 transition-all duration-300 ${tabContentVisible ? 'opacity-100 translate-x-0' : `opacity-0 ${tabDirection === 'right' ? '-translate-x-4' : 'translate-x-4'}`}`}>
            {/* Action Required */}
            {actionItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Action Required</h3>
                  <span className="text-[10px] font-semibold bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">{actionItems.length}</span>
                </div>
                {actionItems.slice(0, 3).map(item => (
                  <Link key={item.id} href={item.action} className="flex items-center gap-3 bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 cursor-pointer active:scale-[0.98] transition-transform">
                    <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <i className={`${item.icon} ${item.color} text-lg`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${item.color}`}>{item.text}</p>
                      <p className="text-xs text-slate-500">{item.subtext}</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-slate-500 text-lg"></i>
                  </Link>
                ))}
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-money-pound-circle-line text-emerald-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">£{guard?.total_earnings ? Number(guard.total_earnings).toFixed(2) : '0.00'}</p>
                <p className="text-xs text-slate-500">Total Earnings</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-checkbox-circle-line text-teal-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{guard?.total_jobs_completed || 0}</p>
                <p className="text-xs text-slate-500">Jobs Done</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-calendar-line text-blue-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{upcomingJobs.length}</p>
                <p className="text-xs text-slate-500">Upcoming</p>
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center mb-2">
                  <i className="ri-star-line text-amber-400 text-lg"></i>
                </div>
                <p className="text-xl font-bold text-white">{guard?.rating ? guard.rating.toFixed(1) : 'N/A'}</p>
                <p className="text-xs text-slate-500">Rating</p>
              </div>
            </div>

            {/* Application Tracker */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Application Tracker</h3>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Applied', count: appCounts.applied, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Shortlisted', count: appCounts.shortlisted, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Selected', count: appCounts.selected, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                  { label: 'Rejected', count: appCounts.rejected, color: 'text-red-400', bg: 'bg-red-500/10' },
                  { label: 'Confirmed', count: appCounts.confirmed, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-1`}>
                      <span className={`text-sm font-bold ${stat.color}`}>{stat.count}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Cards */}
            <div className="space-y-3">
              {siaStatus && (
                <div className={`bg-[#111d35] rounded-xl border ${siaStatus.border} p-4 flex items-center justify-between active:scale-[0.98] transition-transform`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${siaStatus.bg} rounded-xl flex items-center justify-center`}>
                      <i className={`${siaStatus.icon} ${siaStatus.color} text-xl`}></i>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${siaStatus.color}`}>{siaStatus.text}</p>
                      <p className="text-xs text-slate-500">SIA Licence</p>
                    </div>
                  </div>
                  <Link href="/guard/profile" className="text-xs text-teal-400 font-medium cursor-pointer">
                    Update
                  </Link>
                </div>
              )}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <i className="ri-user-settings-line text-blue-400 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Profile {profilePercent}%</p>
                      <p className="text-xs text-slate-500">Completion</p>
                    </div>
                  </div>
                  <Link href="/guard/profile" className="text-xs text-teal-400 font-medium cursor-pointer">
                    Edit
                  </Link>
                </div>
                <div className="h-2 bg-[#162036] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all duration-700" style={{ width: `${profilePercent}%` }}></div>
                </div>
              </div>
              {subStatus && (
                <div className={`bg-[#111d35] rounded-xl border ${subStatus.border} p-4 flex items-center justify-between active:scale-[0.98] transition-transform`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${subStatus.bg} rounded-xl flex items-center justify-center`}>
                      <i className={`${subStatus.icon} ${subStatus.color} text-xl`}></i>
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
            </div>

            {/* Earnings Mini */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Earnings</h3>
                <Link href="/guard/earnings" className="text-xs text-teal-400 font-medium cursor-pointer">View All</Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-white">£{earnings.totalEarned.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-amber-400">£{earnings.totalPending.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-400">£{earnings.totalPaid.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Paid</p>
                </div>
              </div>
            </div>

            {/* Today's Jobs */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Today's Shifts</h3>
                <button onClick={() => handleTabChange('shifts')} className="text-xs text-teal-400 font-medium cursor-pointer">
                  View All
                </button>
              </div>
              {todaysJobs.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-2">
                    <i className="ri-calendar-line text-slate-600 text-xl"></i>
                  </div>
                  <p className="text-sm text-slate-500">No shifts today</p>
                  <p className="text-xs text-slate-600 mt-1">Rest up or find new jobs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaysJobs.map(job => (
                    <div key={job.id} className="bg-[#162036] rounded-xl p-3 border border-[#1e2d4d]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{(job.jobs as any)?.job_title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(job.status)}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {(job.jobs as any)?.start_time} - {(job.jobs as any)?.end_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-map-pin-line"></i>
                          {(job.jobs as any)?.location}
                        </span>
                      </div>
                      {job.status === 'confirmed' && (
                        <button
                          onClick={() => handleCheckIn(job.id)}
                          className="w-full bg-teal-500 text-slate-900 text-xs font-semibold py-2 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
                        >
                          Check In
                        </button>
                      )}
                      {job.status === 'in_progress' && (
                        <button
                          onClick={() => handleCheckOut(job.id)}
                          className="w-full bg-emerald-500 text-slate-900 text-xs font-semibold py-2 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
                        >
                          Check Out
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <Link href="/jobs" className="flex-shrink-0 bg-teal-500 text-slate-900 rounded-xl p-3 text-center w-[140px] cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-slate-900/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <i className="ri-briefcase-line text-xl"></i>
                </div>
                <p className="text-sm font-semibold">Find Jobs</p>
              </Link>
              <Link href="/guard/earnings" className="flex-shrink-0 bg-[#111d35] border border-[#1e2d4d] text-white rounded-xl p-3 text-center w-[140px] cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <i className="ri-wallet-3-line text-emerald-400 text-xl"></i>
                </div>
                <p className="text-sm font-semibold">Earnings</p>
              </Link>
              <button onClick={() => handleTabChange('messages')} className="flex-shrink-0 bg-[#111d35] border border-[#1e2d4d] text-white rounded-xl p-3 text-center w-[140px] cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <i className="ri-message-3-line text-teal-400 text-xl"></i>
                </div>
                <p className="text-sm font-semibold">Messages</p>
              </button>
              <button onClick={() => handleTabChange('profile')} className="flex-shrink-0 bg-[#111d35] border border-[#1e2d4d] text-white rounded-xl p-3 text-center w-[140px] cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <i className="ri-user-settings-line text-blue-400 text-xl"></i>
                </div>
                <p className="text-sm font-semibold">Profile</p>
              </button>
            </div>
          </div>
        );

      case 'jobs':
        return (
          <div className={`space-y-3 transition-all duration-300 ${tabContentVisible ? 'opacity-100 translate-x-0' : `opacity-0 ${tabDirection === 'right' ? '-translate-x-4' : 'translate-x-4'}`}`}>
            <div className="flex items-center gap-2 bg-[#111d35] rounded-xl border border-[#1e2d4d] px-3 py-2.5">
              <i className="ri-search-line text-slate-500 text-sm"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs..."
                className="bg-transparent text-sm text-white placeholder-slate-500 outline-none flex-1"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-close-line text-slate-500 text-sm"></i>
                </button>
              )}
            </div>
            {filteredJobs.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
                  <i className="ri-briefcase-line text-slate-600 text-xl"></i>
                </div>
                <p className="text-sm text-slate-500">No jobs available</p>
                <p className="text-xs text-slate-600 mt-1">Check back later for new opportunities</p>
              </div>
            ) : (
              filteredJobs.map(job => {
                const hasApplied = applications.some(app => (app.jobs as any)?.id === job.id);
                const isApplying = applyingTo === job.id;
                return (
                  <div key={job.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-white flex-1 pr-2">{job.job_title}</p>
                      <p className="text-sm font-bold text-teal-400 flex-shrink-0">£{job.hourly_rate}/hr</p>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{job.clients?.company_name || 'Company'}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>
                        {job.venue_city}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line"></i>
                        {formatDate(job.start_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {formatTime(job.start_time)}
                      </span>
                    </div>
                    {job.licence_required && (
                      <div className="flex items-center gap-1 mb-3">
                        <i className="ri-shield-line text-amber-400 text-xs"></i>
                        <span className="text-xs text-amber-400">{job.licence_required}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {job.number_of_guards ? `${job.number_of_guards} guard${job.number_of_guards > 1 ? 's' : ''} needed` : 'Open role'}
                      </span>
                      {hasApplied ? (
                        <span className="text-xs text-slate-500 bg-[#162036] px-3 py-1.5 rounded-lg border border-[#1e2d4d] flex items-center gap-1">
                          <i className="ri-check-line"></i>
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApplyToJob(job.id)}
                          disabled={isApplying}
                          className="bg-teal-500 text-slate-900 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                          {isApplying ? 'Applying...' : 'Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'shifts':
        return (
          <div className={`space-y-3 transition-all duration-300 ${tabContentVisible ? 'opacity-100 translate-x-0' : `opacity-0 ${tabDirection === 'right' ? '-translate-x-4' : 'translate-x-4'}`}`}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold text-white">My Shifts</h2>
              <span className="text-xs text-slate-500">({assignments.length} total)</span>
            </div>
            {assignments.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
                  <i className="ri-calendar-line text-slate-600 text-xl"></i>
                </div>
                <p className="text-sm text-slate-500">No active shifts</p>
                <p className="text-xs text-slate-600 mt-1">Apply to jobs to get started</p>
                <button onClick={() => handleTabChange('jobs')} className="mt-3 text-xs text-teal-400 font-semibold cursor-pointer">
                  Browse Jobs
                </button>
              </div>
            ) : (
              assignments.map(assignment => {
                const isToday = (assignment.jobs as any)?.start_date === todayStr;
                const isConfirmed = assignment.status === 'confirmed';
                const isInProgress = assignment.status === 'in_progress';
                return (
                  <div key={assignment.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white flex-1 pr-2">{(assignment.jobs as any)?.job_title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${getStatusBadge(assignment.status)}`}>
                        {assignment.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line"></i>
                        {formatDate((assignment.jobs as any)?.start_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {(assignment.jobs as any)?.start_time} - {(assignment.jobs as any)?.end_time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <i className="ri-map-pin-line"></i>
                        {(assignment.jobs as any)?.location}
                      </span>
                      <p className="text-sm font-bold text-teal-400">
                        {assignment.payment_amount ? `£${Number(assignment.payment_amount).toFixed(2)}` : `£${(assignment.jobs as any)?.hourly_rate}/hr`}
                      </p>
                    </div>
                    {assignment.payment_status && (
                      <p className="text-xs text-slate-500 mb-2">
                        Payment: <span className="text-slate-300">{assignment.payment_status}</span>
                      </p>
                    )}
                    {isToday && isConfirmed && (
                      <button
                        onClick={() => handleCheckIn(assignment.id)}
                        className="w-full bg-teal-500 text-slate-900 text-xs font-semibold py-2.5 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
                      >
                        Check In Now
                      </button>
                    )}
                    {isToday && isInProgress && (
                      <button
                        onClick={() => handleCheckOut(assignment.id)}
                        className="w-full bg-emerald-500 text-slate-900 text-xs font-semibold py-2.5 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
                      >
                        Check Out
                      </button>
                    )}
                    {!isToday && (
                      <div className="flex gap-2">
                        <button className="flex-1 bg-[#162036] border border-[#1e2d4d] text-white text-xs font-semibold py-2 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform">
                          View Details
                        </button>
                        <button className="flex-1 bg-[#162036] border border-[#1e2d4d] text-white text-xs font-semibold py-2 rounded-lg cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform">
                          Get Directions
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );

      case 'messages':
        return (
          <div className={`space-y-3 transition-all duration-300 ${tabContentVisible ? 'opacity-100 translate-x-0' : `opacity-0 ${tabDirection === 'right' ? '-translate-x-4' : 'translate-x-4'}`}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Messages</h2>
              {unreadCount > 0 && (
                <span className="text-xs text-slate-500">{unreadCount} unread</span>
              )}
            </div>
            {responses.length === 0 ? (
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-8 text-center">
                <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
                  <i className="ri-message-3-line text-slate-600 text-xl"></i>
                </div>
                <p className="text-sm text-slate-500">No messages yet</p>
                <p className="text-xs text-slate-600 mt-1">Clients will reach out here</p>
              </div>
            ) : (
              responses.map(response => (
                <div
                  key={response.id}
                  className={`bg-[#111d35] rounded-xl border ${!response.is_read ? 'border-teal-500/30' : 'border-[#1e2d4d]'} p-4 active:scale-[0.98] transition-transform`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!response.is_read ? 'bg-teal-500/10' : 'bg-[#162036]'}`}>
                      <i className={`${getResponseIcon(response.response_type)} ${getResponseColor(response.response_type)} text-lg`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-white">
                          {response.response_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        {!response.is_read && (
                          <span className="w-2.5 h-2.5 bg-teal-400 rounded-full flex-shrink-0 shadow-sm shadow-teal-400/30"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{response.clients?.company_name || 'Client'} {response.jobs?.job_title ? `• ${response.jobs.job_title}` : ''}</p>
                      <p className="text-sm text-slate-300 mb-2 leading-relaxed">{response.message}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">{new Date(response.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        {!response.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(response.id)}
                            className="text-xs text-teal-400 font-medium cursor-pointer px-2 py-1 bg-teal-500/10 rounded-lg"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'profile':
        return (
          <div className={`space-y-4 transition-all duration-300 ${tabContentVisible ? 'opacity-100 translate-x-0' : `opacity-0 ${tabDirection === 'right' ? '-translate-x-4' : 'translate-x-4'}`}`}>
            {/* Profile Card */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-3 overflow-hidden ring-4 ring-[#0B1933] shadow-lg shadow-teal-500/10">
                {guard?.profile_image_url ? (
                  <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {(guard?.full_name || 'GU').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white">{guard?.full_name || 'Guard'}</h2>
              <p className="text-xs text-slate-500 mt-1">{guard?.location || 'Location not set'} {guard?.years_experience ? `• ${guard.years_experience} years exp` : ''}</p>
              {guard?.rating && guard.rating > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <i className="ri-star-fill text-amber-400 text-sm"></i>
                  <span className="text-sm font-semibold text-white">{guard.rating.toFixed(1)}</span>
                  <span className="text-xs text-slate-500">({guard?.total_reviews || 0} reviews)</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{guard?.total_jobs_completed || 0}</p>
                  <p className="text-[10px] text-slate-500">Jobs</p>
                </div>
                <div className="w-px h-6 bg-[#1e2d4d]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">£{guard?.total_earnings ? Number(guard.total_earnings).toFixed(0) : '0'}</p>
                  <p className="text-[10px] text-slate-500">Earned</p>
                </div>
                <div className="w-px h-6 bg-[#1e2d4d]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{guard?.years_experience || 0}y</p>
                  <p className="text-[10px] text-slate-500">Experience</p>
                </div>
              </div>
            </div>

            {/* Menu Links */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
              <Link href="/guard/profile" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer active:bg-[#162036] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-teal-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-user-settings-line text-teal-400 text-lg"></i>
                  </div>
                  <div>
                    <span className="text-sm text-white block">Edit Profile</span>
                    <span className="text-[10px] text-slate-500">Personal info, SIA, docs</span>
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/guard/earnings" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer active:bg-[#162036] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-wallet-3-line text-emerald-400 text-lg"></i>
                  </div>
                  <div>
                    <span className="text-sm text-white block">Earnings</span>
                    <span className="text-[10px] text-slate-500">Payments & payouts</span>
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/guard/bank-settings" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer active:bg-[#162036] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-bank-card-line text-blue-400 text-lg"></i>
                  </div>
                  <div>
                    <span className="text-sm text-white block">Bank Settings</span>
                    <span className="text-[10px] text-slate-500">{bankDetails ? bankDetails.bank_name || 'Bank saved' : 'Add payment details'}</span>
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <Link href="/guard/notification-settings" className="flex items-center justify-between px-4 py-4 border-b border-[#1e2d4d] cursor-pointer active:bg-[#162036] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-notification-3-line text-amber-400 text-lg"></i>
                  </div>
                  <div>
                    <span className="text-sm text-white block">Notifications</span>
                    <span className="text-[10px] text-slate-500">Push, email preferences</span>
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-slate-500"></i>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between px-4 py-4 cursor-pointer active:bg-[#162036] transition-colors"
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
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col">
      <MobileInstallPrompt role="guard" />
      <PushNotificationPrompt role="guard" />

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-4 pt-10 pb-5 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-shield-check-line text-white text-lg"></i>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Guard Portal</p>
              <h1 className="text-white font-bold text-lg leading-tight">{getGreeting()}, {guard?.full_name?.split(' ')[0] || 'Guard'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {subscribed && (
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center" title="Push notifications enabled">
                <i className="ri-notification-3-line text-white text-sm"></i>
              </div>
            )}
            <button onClick={handleRefresh} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center cursor-pointer active:bg-white/30 transition-colors">
              <i className={`ri-refresh-line text-white text-xl ${refreshing ? 'animate-spin' : ''}`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 px-4 py-4 overflow-y-auto"
        onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
        onTouchEnd={handlePullRefresh}
      >
        {refreshing && (
          <div className="flex items-center justify-center py-3 mb-2">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-xs text-slate-500">Refreshing...</span>
          </div>
        )}
        {tabContent()}
        <div className="h-6" />
      </div>

      {/* Switch to Full Dashboard */}
      <div className="px-4 pb-2">
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-computer-line text-slate-500 text-sm"></i>
            <p className="text-xs text-slate-500">On desktop?</p>
          </div>
          <Link href="/guard/dashboard" className="text-xs text-teal-400 font-semibold cursor-pointer">
            Full Dashboard
          </Link>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        tabs={guardTabs.map(t => ({ ...t, badge: t.id === 'messages' ? unreadCount : undefined }))}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}