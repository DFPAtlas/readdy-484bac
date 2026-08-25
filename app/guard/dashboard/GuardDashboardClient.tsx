'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import NotificationHistory from './NotificationHistory';
import RealtimeToastContainer, { showRealtimeToast } from '@/components/RealtimeToast';
import ReviewsTab from './ReviewsTab';
import GuardAnnouncements from './GuardAnnouncements';
import GuardPromoCard from './GuardPromoCard';
import PlanManagementCard from '@/components/PlanManagementCard';
import RoleSwitchModal from '@/components/RoleSwitchModal';
import SIALicenceStatusCard from './SIALicenceStatusCard';
import MobileQRCodeCard from '@/components/MobileQRCodeCard';
import JobMatchToast from './JobMatchToast';
import FundedBadge from './FundedBadge';
import { hasFeature, ensureEntitlement } from '@/lib/entitlements';
import type { FeatureKey } from '@/lib/entitlements';
import UpgradeRequiredModal from '@/components/billing/UpgradeRequiredModal';
import { checkGuardApplicationLimit } from '@/lib/guard-application-limits';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import UsageLimitWidget from '@/components/UsageLimitWidget';

interface UserEntitlement {
  plan_slug: string;
  plan_name: string;
  subscription_status: string;
  is_active: boolean;
  is_free_tier: boolean;
  current_period_end: string;
}

import DashboardHeader from './DashboardHeader';
import ProfileHeroCard from './ProfileHeroCard';
import ActionRequiredPanel from './ActionRequiredPanel';
import StatsOverview from './StatsOverview';
import UpcomingShiftsPanel from './UpcomingShiftsPanel';
import RecommendedJobsPanel from './RecommendedJobsPanel';
import ApplicationTracker from './ApplicationTracker';
import CompliancePanel from './CompliancePanel';
import EarningsMiniPanel from './EarningsMiniPanel';
import MobileQuickActions from './MobileQuickActions';
import QuickActionsPanel from './QuickActionsPanel';
import PaymentFlowCard from '@/components/guard/PaymentFlowCard';

import { Guard, JobAssignment, JobApplication, AvailableJob, AvailableJobWithDistance, ClientResponse, ShiftItem } from './types';
import { haversineDistanceMiles, formatDistance } from './distance';

export default function GuardDashboardClient() {
  const router = useSafeRouter();
  const { loading: authLoading, allowed, roleSwitch } = useGuardGuard();
  const [guard, setGuard] = useState<Guard | null>(null);
  const [guardUserId, setGuardUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<JobAssignment[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [responses, setResponses] = useState<ClientResponse[]>([]);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [availableJobsPage, setAvailableJobsPage] = useState(0);
  const [hasMoreAvailableJobs, setHasMoreAvailableJobs] = useState(true);
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);
  const AVAILABLE_JOBS_PAGE_SIZE = 12;
  const [contactSubmissions, setContactSubmissions] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');
  const [filterStatus, setFilterStatus] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEntitlement, setUserEntitlement] = useState<UserEntitlement | null>(null);
  const [guardToast, setGuardToast] = useState('');
  const [markingJobId, setMarkingJobId] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedFeatureName, setBlockedFeatureName] = useState('');
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const [dataLoadFailed, setDataLoadFailed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { guardLimit, loading: usageLoading, refresh: refreshUsage } = useUsageLimits(guardUserId);

  const traceLog = useCallback((label: string, data: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GuardDashboard:${label}]`, JSON.stringify({ timestamp: new Date().toISOString(), ...data }, null, 2));
    }
  }, []);

  const isJobNearby = useCallback((job: any) => {
    if (!guard?.location && !guard?.postcode) return true;
    const gLoc = (guard?.location || '').toLowerCase();
    const gPost = (guard?.postcode || '').toLowerCase();
    const city = (job.venue_city || '').toLowerCase();
    const postcode = (job.venue_postcode || '').toLowerCase();
    return city.includes(gLoc) || gLoc.includes(city) ||
      postcode.includes(gPost) || gPost.includes(postcode) ||
      city.includes(gPost) || gLoc.includes(postcode);
  }, [guard?.location, guard?.postcode]);

  const loadPendingApprovals = useCallback(async () => {
    if (!guardUserId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-completion-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();
      if (data.requests) {
        setPendingApprovals(data.requests.filter((r: any) => r.status === 'pending'));
      }
    } catch {}
  }, [guardUserId]);

  useEffect(() => {
    if (!guardUserId) return;
    loadPendingApprovals();
  }, [guardUserId, loadPendingApprovals]);

  const handleMarkJobComplete = async (assignmentId: string, jobId: string) => {
    if (isAdmin || !guard) return;
    setMarkingJobId(assignmentId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-job-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ jobId, assignmentId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to request completion');
      await loadJobAssignments(guardUserId!, isAdmin);
      await loadPendingApprovals();
      showGuardToast('Job marked complete — awaiting client approval');
    } catch (err: any) {
      showGuardToast(err.message || 'Failed to mark complete');
    } finally {
      setMarkingJobId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        traceLog('authEvent', { event, userId: session?.user?.id, pathname: typeof window !== 'undefined' ? window.location.pathname : '' });
        if (!session?.user) return;
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!mounted) return;
        if (adminData) {
          setIsAdmin(true);
          setGuardUserId(session.user.id);
        }
        await loadDashboardData(session.user.id, !!adminData);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) router.push('/guard/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!guardUserId) return;
    const resolvedUserId = guardUserId;
    const channel = supabase
      .channel('guard-dashboard-live-v2')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_assignments' }, () => loadJobAssignments(resolvedUserId, false))
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_applications' }, () => loadJobApplications(resolvedUserId, false))
      .on('postgres_changes', { event: '*', schema: 'app', table: 'client_responses' }, () => loadClientResponses(resolvedUserId, false))
      .on('postgres_changes', { event: '*', schema: 'app', table: 'jobs' }, () => loadAvailableJobs(0))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guardUserId, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (!featureFlags['guard.advanced_alerts']) return;
    const jobsChannel = supabase
      .channel('guard-new-jobs-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'jobs' },
        (payload) => {
          const job = payload.new as any;
          if (isJobNearby(job)) {
            showRealtimeToast(
              `New job near ${guard?.location || 'you'}: ${job.job_title} @ ${job.venue_city}`,
              'success'
            );
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(jobsChannel); };
  }, [isAdmin, isJobNearby, guard?.location, featureFlags]);

  useEffect(() => {
    if (guard?.id) {
      loadBankDetails(guard.id);
    }
  }, [guard?.id]);

  useEffect(() => {
    if (!guard?.id || !guardUserId) return;
    const channel = supabase
      .channel(`guard-dashboard-support-${guard.id}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'support_tickets', filter: `guard_id=eq.${guard.id}` }, () => {
        loadOpenTicketCount(guardUserId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guard?.id, guardUserId]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['assignments', 'upcoming', 'applications', 'responses', 'available', 'reviews', 'notifications', 'support'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  const loadDashboardData = async (userId: string, adminMode: boolean = false) => {
    setLoading(true);
    setDataErrors([]);
    setDataLoadFailed(false);
    traceLog('loadDashboardData', { userId, adminMode, pathname: typeof window !== 'undefined' ? window.location.pathname : '' });
    if (adminMode) setIsAdmin(true);
    await Promise.all([
      loadGuardProfile(userId, adminMode),
      loadJobAssignments(userId, adminMode),
      loadJobApplications(userId, adminMode),
      loadClientResponses(userId, adminMode),
      loadAvailableJobs(),
      loadContactSubmissions(userId),
      loadOpenTicketCount(userId),
      loadUserEntitlement(userId),
    ]);
    traceLog('loadDashboardDataComplete', { dataErrors, guardLoaded: !!guard });
    setLoading(false);
  };

  const loadGuardProfile = async (userId: string, adminMode: boolean = false) => {
    try {
      setGuardUserId(userId);
      const { data, error } = await supabase
        .from('guards')
        .select('id, full_name, email, profile_image_url, location, postcode, years_experience, rating, total_reviews, total_jobs_completed, total_earnings, verification_status, profile_completed, subscription_status, accepts_direct_bookings, sia_licence_front_url, sia_expiry_date, licence_types, sia_licence_number, phone, sia_verified, is_active, dashboard_access, home_latitude, home_longitude')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      traceLog('loadGuardProfile', { userId, hasData: !!data, verificationStatus: data?.verification_status, profileCompleted: data?.profile_completed, dashboardAccess: data?.dashboard_access });
      if (!data) {
        if (!adminMode) {
          setDataErrors(prev => [...prev, 'guard_profile']);
          setDataLoadFailed(true);
        }
        return;
      }
      setGuard(data);
    } catch {
      setDataErrors(prev => [...prev, 'guard_profile']);
      setDataLoadFailed(true);
    }
  };

  const loadUserEntitlement = async (userId: string) => {
    try {
      const data = await ensureEntitlement(userId, 'guard');
      traceLog('loadUserEntitlement', { hasData: !!data, planSlug: data?.plan_slug });
      setUserEntitlement(data as UserEntitlement | null);

      const flags: Record<string, boolean> = {};
      const keys: FeatureKey[] = [
        'guard.apply_job',
        'guard.advanced_alerts',
      ];
      for (const key of keys) {
        flags[key] = await hasFeature(userId, key);
      }
      setFeatureFlags(flags);
      setEntitlementsLoaded(true);
    } catch {
      traceLog('loadUserEntitlement', { error: true });
      setEntitlementsLoaded(true);
    }
  };

  useEffect(() => {
    if (!guardUserId) return;
    const channel = supabase
      .channel(`guard-entitlement-${guardUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'user_entitlements_data', filter: `user_id=eq.${guardUserId}` },
        () => { loadUserEntitlement(guardUserId); refreshUsage(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'subscriptions', filter: `user_id=eq.${guardUserId}` },
        () => { loadUserEntitlement(guardUserId); refreshUsage(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guardUserId, refreshUsage]);

  const loadJobAssignments = async (userId: string, adminMode: boolean = false) => {
    try {
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!guardData) return;
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          id,
          status,
          payment_amount,
          payment_status,
          assigned_at,
          jobs!inner (
            id,
            job_title,
            venue_city,
            venue_postcode,
            start_date,
            start_time,
            end_time,
            hourly_rate,
            payment_status
          )
        `)
        .eq('guard_id', guardData.id)
        .in('status', ['confirmed', 'in_progress', 'pending'])
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      const all = data || [];
      traceLog('loadJobAssignments', { count: all.length });
      setAssignments(all);
      const today = new Date().toISOString().split('T')[0];
      const upcoming = all
        .filter(a => ['confirmed', 'pending'].includes(a.status) && (a.jobs as any)?.start_date >= today)
        .sort((a, b) =>
          ((a.jobs as any)?.start_date || '').localeCompare((b.jobs as any)?.start_date || '')
        );
      setUpcomingJobs(upcoming);
    } catch {
      traceLog('loadJobAssignments', { error: true });
      setDataErrors(prev => [...prev, 'job_assignments']);
    }
  };

  const loadJobApplications = async (userId?: string, adminMode: boolean = false) => {
    try {
      const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
      if (!resolvedUserId) return;
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', resolvedUserId)
        .maybeSingle();
      if (!guardData) return;
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          status,
          applied_at,
          jobs!inner (
            id,
            job_title,
            venue_city,
            venue_postcode,
            start_date,
            start_time,
            end_time,
            hourly_rate,
            clients (
              company_name
            )
          )
        `)
        .eq('guard_id', guardData.id)
        .order('applied_at', { ascending: false });
      if (error) throw error;
      traceLog('loadJobApplications', { count: (data || []).length });
      setApplications(data || []);
    } catch {
      traceLog('loadJobApplications', { error: true });
      setDataErrors(prev => [...prev, 'job_applications']);
    }
  };

  const loadClientResponses = async (userId: string, adminMode: boolean = false) => {
    try {
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!guardData) return;
      const { data, error } = await supabase
        .from('client_responses')
        .select(`
          id,
          response_type,
          message,
          is_read,
          created_at,
          jobs (
            job_title
          ),
          clients (
            company_name
          )
        `)
        .eq('guard_id', guardData.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      traceLog('loadClientResponses', { count: (data || []).length });
      setResponses(data || []);
      setUnreadCount(data?.filter(r => !r.is_read).length || 0);
    } catch {
      traceLog('loadClientResponses', { error: true });
      setDataErrors(prev => [...prev, 'client_responses']);
    }
  };

  const loadContactSubmissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setContactSubmissions(data || []);
    } catch {
      setDataErrors(prev => [...prev, 'contact_submissions']);
    }
  };

  const loadOpenTicketCount = async (userId: string) => {
    try {
      const { data: guardData } = await supabase
        .from('guards')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!guardData) return;
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('guard_id', guardData.id)
        .eq('is_deleted', false)
        .in('status', ['open', 'awaiting_guard', 'under_review', 'escalated']);
      if (error) throw error;
      setOpenTicketCount((data || []).length);
    } catch {
      setDataErrors(prev => [...prev, 'support_tickets']);
    }
  };

  const loadAvailableJobs = async (page: number = 0) => {
    try {
      const from = page * AVAILABLE_JOBS_PAGE_SIZE;
      const to = from + AVAILABLE_JOBS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          job_title,
          venue_city,
          venue_postcode,
          start_date,
          start_time,
          end_time,
          hourly_rate,
          status,
          latitude,
          longitude,
          clients (
            company_name
          )
        `)
        .eq('status', 'open')
        .eq('is_deleted', false)
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true })
        .range(from, to);
      if (error) throw error;
      const fetched = data || [];
      traceLog('loadAvailableJobs', { page, count: fetched.length });
      if (page === 0) {
        setAvailableJobs(fetched);
      } else {
        setAvailableJobs(prev => [...prev, ...fetched]);
      }
      setHasMoreAvailableJobs(fetched.length === AVAILABLE_JOBS_PAGE_SIZE);
      setAvailableJobsPage(page);
    } catch {
      traceLog('loadAvailableJobs', { error: true });
      setDataErrors(prev => [...prev, 'available_jobs']);
    }
  };

  const handleLoadMoreAvailable = async () => {
    setLoadingMoreJobs(true);
    await loadAvailableJobs(availableJobsPage + 1);
    setLoadingMoreJobs(false);
  };

  const loadBankDetails = async (guardId: string) => {
    try {
      const { data } = await supabase
        .from('guard_bank_details')
        .select('id')
        .eq('guard_id', guardId)
        .maybeSingle();
      setBankDetails(data || null);
    } catch {}
  };

  const markAsRead = async (responseId: string) => {
    if (isAdmin) return;
    try {
      const { error } = await supabase
        .from('client_responses')
        .update({ is_read: true })
        .eq('id', responseId);
      if (!error) {
        setResponses(prev => prev.map(r => r.id === responseId ? { ...r, is_read: true } : r));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const showGuardToast = (msg: string) => {
    setGuardToast(msg);
    setTimeout(() => setGuardToast(''), 3500);
  };

  const handleAcceptOffer = async (responseId: string, applicationId: string) => {
    if (isAdmin) return;
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', applicationId)
        .eq('guard_id', guard?.id);
      if (error) throw error;
      await markAsRead(responseId);
      await loadJobApplications();
      await loadAvailableJobs();
      showGuardToast('Job offer accepted!');
    } catch {
      showGuardToast('Failed to accept offer. Please try again.');
    }
  };

  const handleDeclineOffer = async (responseId: string, applicationId: string) => {
    if (isAdmin) return;
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', applicationId)
        .eq('guard_id', guard?.id);
      if (error) throw error;
      await markAsRead(responseId);
      await loadJobApplications();
      await loadAvailableJobs();
      showGuardToast('Job offer declined.');
    } catch {
      showGuardToast('Failed to decline offer. Please try again.');
    }
  };

  const handleApplyToJob = async (jobId: string) => {
    if (isAdmin || !guard) return;

    if (entitlementsLoaded && !featureFlags['guard.apply_job']) {
      setBlockedFeatureName('job applications');
      setShowUpgradeModal(true);
      return;
    }

    if (guard.verification_status !== 'approved' && guard.verification_status !== 'verified') {
      const msg = 'Your profile is not yet verified. You cannot apply for jobs.';
      showGuardToast(msg);
      return;
    }

    try {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('status, sia_licence_required, required_licence_types')
        .eq('id', jobId)
        .maybeSingle();

      if (!jobData) {
        showGuardToast('Job not found.');
        return;
      }

      if (jobData.status !== 'open') {
        showGuardToast('This job is no longer open for applications.');
        return;
      }

      if (jobData.sia_licence_required && jobData.required_licence_types && jobData.required_licence_types.length > 0) {
        const guardLicences = guard.licence_types || [];
        const hasRequired = jobData.required_licence_types.some((req: string) =>
          guardLicences.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
        );
        if (!hasRequired) {
          showGuardToast(`This job requires SIA licence types you do not hold: ${jobData.required_licence_types.join(', ')}.`);
          return;
        }
      }

      const limitCheck = await checkGuardApplicationLimit(supabase, guard.id);
      if (!limitCheck.allowed) {
        if (limitCheck.reason === 'limit_reached') {
          showGuardToast('You have reached your monthly application limit for your current plan. Upgrade your plan to apply for more jobs this month.');
          router.push('/upgrade?reason=guard_application_limit_reached');
        } else {
          showGuardToast('We could not verify your guard subscription plan. Please refresh or contact support.');
          router.push('/upgrade?reason=guard.plan_verification_failed');
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';

      const applyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/apply-to-job`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId: guard.id,
            jobId,
            coverMessage: '',
          }),
        }
      );

      const applyResult = await applyResponse.json();

      if (!applyResponse.ok) {
        if (applyResult.alreadyApplied) {
          showGuardToast('You have already applied to this job.');
          return;
        }
        if (applyResult.limitReached) {
          showGuardToast('You have reached your monthly application limit. Upgrade your plan to apply for more jobs.');
          router.push('/upgrade?reason=guard_application_limit_reached');
          return;
        }
        if (applyResult.tierLocked) {
          showGuardToast('Your current plan does not allow applying to this job tier. Please upgrade.');
          router.push('/upgrade?reason=guard.unlimited_applications');
          return;
        }
        showGuardToast(applyResult.error || 'Failed to apply. Please try again.');
        return;
      }

      await loadJobApplications();
      await loadAvailableJobs();
      refreshUsage();
      showGuardToast('Application submitted successfully!');
    } catch (error: any) {
      showGuardToast('Failed to apply. Please try again.');
    }
  };

  const handleConfirmShift = async (applicationId: string) => {
    if (isAdmin || !guard) return;
    try {
      const { data: appData } = await supabase
        .from('job_applications')
        .select('job_id, guard_id')
        .eq('id', applicationId)
        .maybeSingle();
      if (!appData) throw new Error('Application not found');

      await supabase
        .from('job_applications')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', applicationId);

      await supabase
        .from('job_assignments')
        .upsert(
          { job_id: appData.job_id, guard_id: appData.guard_id, status: 'confirmed', assigned_at: new Date().toISOString() },
          { onConflict: 'job_id,guard_id', ignoreDuplicates: false }
        );

      await loadJobApplications();
      await loadJobAssignments(guardUserId!, isAdmin);
      showGuardToast('Shift confirmed!');
    } catch {
      showGuardToast('Failed to confirm. Please try again.');
    }
  };

  const handleCheckIn = async (assignmentId: string) => {
    if (isAdmin || !guard) return;
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({
          status: 'in_progress',
          attendance_status: 'checked_in',
          check_in_time: new Date().toISOString(),
        })
        .eq('id', assignmentId)
        .eq('guard_id', guard.id);
      if (error) throw error;
      await loadJobAssignments(guardUserId!, isAdmin);
      showGuardToast('Checked in successfully!');
    } catch {
      showGuardToast('Failed to check in. Please try again.');
    }
  };

  const handleCheckOut = async (assignmentId: string) => {
    if (isAdmin || !guard) return;
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({
          status: 'completed',
          attendance_status: 'checked_out',
          check_out_time: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId)
        .eq('guard_id', guard.id);
      if (error) throw error;
      await loadJobAssignments(guardUserId!, isAdmin);
      showGuardToast('Checked out successfully!');
    } catch {
      showGuardToast('Failed to check out. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch {}
  };

  const allShifts = useMemo(() => {
    const appShifts: ShiftItem[] = applications
      .filter(a => a.status === 'accepted' || a.status === 'confirmed')
      .map(a => ({
        id: a.id,
        source: 'application',
        status: a.status,
        job_title: (a.jobs as any)?.job_title || '',
        location: (a.jobs as any)?.venue_city || '',
        start_date: (a.jobs as any)?.start_date || '',
        start_time: (a.jobs as any)?.start_time || '',
        end_time: (a.jobs as any)?.end_time || '',
        hourly_rate: (a.jobs as any)?.hourly_rate || 0,
        client_name: (a.jobs as any)?.clients?.company_name || '',
        job_id: (a.jobs as any)?.id || '',
      }));
    const assignShifts: ShiftItem[] = assignments
      .filter(a => a.status === 'confirmed' || a.status === 'in_progress' || a.status === 'pending')
      .map(a => ({
        id: a.id,
        source: 'assignment',
        status: a.status,
        job_title: (a.jobs as any)?.job_title || '',
        location: (a.jobs as any)?.venue_city || '',
        start_date: (a.jobs as any)?.start_date || '',
        start_time: (a.jobs as any)?.start_time || '',
        end_time: (a.jobs as any)?.end_time || '',
        hourly_rate: (a.jobs as any)?.hourly_rate || 0,
        client_name: '',
        job_id: (a.jobs as any)?.id || '',
        payment_status: (a.jobs as any)?.payment_status || null,
      } as any));
    return [...appShifts, ...assignShifts]
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);
  }, [applications, assignments]);

  const stats = useMemo(() => {
    const confirmed = applications.filter(a => a.status === 'confirmed').length;
    const pendingApps = applications.filter(a => a.status === 'pending').length;
    const completed = guard?.total_jobs_completed || 0;
    const totalEarnings = Number(guard?.total_earnings || 0).toFixed(2);
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = upcomingJobs.filter(j => (j.jobs as any)?.start_date === today).length;
    const nextShift = upcomingJobs.length > 0 ? upcomingJobs[0] : null;
    const nextShiftLabel = nextShift
      ? new Date((nextShift.jobs as any)?.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null;
    return [
      { label: 'Available Jobs', value: availableJobs.length, icon: 'ri-briefcase-line', color: 'teal', trend: 'open now' },
      { label: 'Applications', value: applications.length, icon: 'ri-send-plane-line', color: 'blue', trend: pendingApps > 0 ? `${pendingApps} pending` : undefined },
      { label: 'Confirmed', value: confirmed, icon: 'ri-checkbox-circle-line', color: 'emerald', trend: todayShifts > 0 ? `${todayShifts} today` : undefined },
      { label: 'Upcoming', value: upcomingJobs.length, icon: 'ri-calendar-line', color: 'amber', trend: nextShiftLabel || undefined },
      { label: 'Completed', value: completed, icon: 'ri-check-double-line', color: 'purple', trend: 'all time' },
      { label: 'Earnings', value: `£${totalEarnings}`, icon: 'ri-money-pound-circle-line', color: 'emerald', trend: 'lifetime' },
    ];
  }, [availableJobs, applications, upcomingJobs, guard]);

  const jobsWithDistance: AvailableJobWithDistance[] = useMemo(() => {
    const gLat = guard?.home_latitude;
    const gLon = guard?.home_longitude;
    return availableJobs.map(job => {
      let distanceMiles: number | null = null;
      if (gLat != null && gLon != null && job.latitude != null && job.longitude != null) {
        distanceMiles = haversineDistanceMiles(gLat, gLon, job.latitude, job.longitude);
      }
      return {
        ...job,
        distanceMiles,
        distanceLabel: formatDistance(distanceMiles),
      };
    }).sort((a, b) => {
      if (a.distanceMiles === null && b.distanceMiles === null) return 0;
      if (a.distanceMiles === null) return 1;
      if (b.distanceMiles === null) return -1;
      return a.distanceMiles - b.distanceMiles;
    });
  }, [availableJobs, guard?.home_latitude, guard?.home_longitude]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
      reviewed: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
      accepted: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
      declined: 'bg-red-500/15 text-red-400 border border-red-500/25',
      confirmed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
      in_progress: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
      completed: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
    };
    return styles[status] || 'bg-slate-500/15 text-slate-400 border border-slate-500/25';
  };

  const getResponseTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      interview_request: 'ri-calendar-line',
      job_offer: 'ri-gift-line',
      rejection: 'ri-close-circle-line',
      question: 'ri-question-line',
      message: 'ri-message-3-line',
    };
    return icons[type] || 'ri-mail-line';
  };

  const filteredApplications = filterStatus === 'all'
    ? applications
    : applications.filter(app => app.status === filterStatus);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
          <p className="mt-4 text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (roleSwitch === 'client') {
    return <RoleSwitchModal targetRole="guard" />;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
          <p className="mt-4 text-slate-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin"></i>
          <p className="mt-4 text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!guard && !isAdmin) {
    if (dataLoadFailed) {
      return (
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full">
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-xl p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/15 rounded-full flex items-center justify-center">
                <i className="ri-error-warning-line text-4xl text-red-400 w-10 h-10 flex items-center justify-center"></i>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Dashboard Data Unavailable</h1>
              <p className="text-slate-400 mb-6 leading-relaxed">
                We found your guard account but could not load your dashboard data.
                This may be a temporary issue.
              </p>
              {dataErrors.length > 0 && (
                <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-4 mb-6 text-left">
                  <p className="text-xs text-slate-500 mb-2">Failed sections: {dataErrors.join(', ')}</p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-refresh-line w-5 h-5 flex items-center justify-center"></i>
                  Retry
                </button>
                <Link
                  href="/contact"
                  className="w-full sm:w-auto px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center"></i>
                  Contact Support
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-6 py-3 border border-red-500/30 text-red-400 rounded-xl font-semibold hover:bg-red-500/10 transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-logout-box-line w-5 h-5 flex items-center justify-center"></i>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Guard profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={guard?.full_name || (isAdmin ? 'Admin Preview' : 'Guard')}
        subtitle={guard?.verification_status === 'approved' || guard?.verification_status === 'verified' ? 'Verified' : 'Guard'}
        initials={guard?.full_name ? guard.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'GU'}
        accentColor="emerald"
        userId={guardUserId}
        collapsible={true}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <div className={`flex-1 min-h-screen pt-16 lg:pt-8 pb-24 px-3 sm:px-4 lg:px-6 lg:pb-8 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        {isAdmin && (
          <div className="max-w-7xl mx-auto mb-6 bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <i className="ri-shield-user-line"></i>
              <span className="font-semibold">Admin Preview Mode</span>
              <span className="text-amber-400/70">— Viewing the guard portal as an administrator</span>
            </div>
            <Link href="/admin/dashboard" className="text-amber-400 text-sm font-medium hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap">
              Back to Admin →
            </Link>
          </div>
        )}

        <GuardAnnouncements />
        <GuardPromoCard guardId={guard?.id || ''} />

        {dataErrors.length > 0 && guard && !isAdmin && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-alert-line text-lg text-amber-400"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-300">Some dashboard data could not be loaded</p>
                  <p className="text-xs text-amber-400/70">
                    {dataErrors.length} section{dataErrors.length !== 1 ? 's' : ''} affected. You can still browse jobs and manage your profile.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDataErrors([]);
                  if (guardUserId) {
                    loadJobAssignments(guardUserId, isAdmin);
                    loadJobApplications(guardUserId, isAdmin);
                    loadClientResponses(guardUserId, isAdmin);
                    loadAvailableJobs(0);
                    loadContactSubmissions(guardUserId);
                    loadOpenTicketCount(guardUserId);
                    loadUserEntitlement(guardUserId);
                  }
                }}
                className="px-4 py-2 bg-amber-500/15 text-amber-400 rounded-xl text-sm font-semibold hover:bg-amber-500/25 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {guard && !isAdmin && userEntitlement && userEntitlement.is_free_tier && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-teal-500/5 border border-teal-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-vip-crown-line text-lg text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-300">Upgrade your plan to unlock priority job matching, featured profile and more.</p>
                </div>
              </div>
              <Link href="/pricing" className="px-4 py-2 bg-teal-500/15 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                View Plans →
              </Link>
            </div>
          </div>
        )}

        {guard && !isAdmin && userEntitlement && userEntitlement.subscription_status === 'trialing' && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-vip-crown-line text-lg text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-300">
                    You're on a free trial until {userEntitlement.current_period_end ? new Date(userEntitlement.current_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'soon'}.
                  </p>
                </div>
              </div>
              <Link href="/guard/profile" className="px-4 py-2 bg-blue-500/15 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                Manage Subscription →
              </Link>
            </div>
          </div>
        )}

        {guard && !isAdmin && userEntitlement && userEntitlement.subscription_status === 'past_due' && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-alert-line text-lg text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-300">Your payment is past due. Please update your payment method to avoid service interruption.</p>
                </div>
              </div>
              <Link href="/guard/profile" className="px-4 py-2 bg-red-500/15 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                Update Payment →
              </Link>
            </div>
          </div>
        )}

        {guard && !isAdmin && userEntitlement && (userEntitlement.subscription_status === 'canceled' || userEntitlement.subscription_status === 'cancelled' || userEntitlement.cancel_at_period_end) && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-lg text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    {userEntitlement.cancel_at_period_end && userEntitlement.current_period_end
                      ? `Your plan will cancel on ${new Date(userEntitlement.current_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Reactivate to keep your benefits.`
                      : 'Your subscription has been cancelled. Reactivate to regain access to paid features.'}
                  </p>
                </div>
              </div>
              <Link href="/pricing" className="px-4 py-2 bg-amber-500/15 text-amber-400 rounded-xl text-sm font-semibold hover:bg-amber-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                View Plans →
              </Link>
            </div>
          </div>
        )}

        {guard && !isAdmin && (
          <SIALicenceStatusCard
            verificationStatus={guard.verification_status}
            siaLicenceFrontUrl={guard.sia_licence_front_url}
            siaExpiryDate={guard.sia_expiry_date}
          />
        )}

        {guard && !isAdmin && (
          <div className="max-w-7xl mx-auto mb-6">
            {guard.accepts_direct_bookings === false ? (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-received-2-line text-lg text-amber-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Direct bookings are turned off</p>
                    <p className="text-xs text-amber-400/80">Venue and event clients can only find you if you opt in</p>
                  </div>
                </div>
                <Link href="/guard/profile" className="px-4 py-2 bg-amber-500/15 text-amber-400 rounded-xl text-sm font-semibold hover:bg-amber-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                  Enable Direct Bookings
                </Link>
              </div>
            ) : (
              <div className="bg-teal-500/5 border border-teal-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-received-2-line text-lg text-teal-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-teal-300">Direct bookings enabled</p>
                    <p className="text-xs text-teal-400/80">Clients can request you directly without going through the job board</p>
                  </div>
                </div>
                <Link href="/guard/profile" className="px-4 py-2 bg-teal-500/15 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/25 transition-colors whitespace-nowrap self-start sm:self-auto">
                  Edit Preferences
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          <DashboardHeader guard={guard} isAdmin={isAdmin} guardUserId={guardUserId} onLogout={handleLogout} />

          {guard && !isAdmin && (
            <ProfileHeroCard 
              guard={guard} 
              planName={userEntitlement?.plan_name}
              subscriptionStatus={userEntitlement?.subscription_status}
            />
          )}

          <ActionRequiredPanel
            guard={guard}
            unreadCount={unreadCount}
            applications={applications}
            upcomingJobs={upcomingJobs}
            bankDetails={bankDetails}
          />

          <StatsOverview stats={stats} />

          {pendingApprovals.length > 0 && (
            <div className="mb-6">
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <i className="ri-time-line text-amber-400 text-lg"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-300">Pending Client Approvals</h3>
                    <p className="text-xs text-amber-400/70">{pendingApprovals.length} job{pendingApprovals.length !== 1 ? 's' : ''} awaiting client review</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingApprovals.slice(0, 3).map((req: any) => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 bg-[#0B1933] rounded-xl p-3 border border-[#1a2b4a]">
                      <div className="flex items-center gap-3">
                        <i className="ri-briefcase-line text-amber-400"></i>
                        <div>
                          <p className="text-sm text-white">{req.jobs?.job_title || 'Job'}</p>
                          <p className="text-xs text-slate-500">Requested {new Date(req.requested_at).toLocaleDateString('en-GB')}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-amber-400 px-2.5 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        Awaiting Approval
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions - full width strip */}
          <div className="mb-6">
            <QuickActionsPanel openTicketCount={openTicketCount} />
          </div>

          {/* Main workspace - equal two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="space-y-6">
              <UpcomingShiftsPanel
                shifts={allShifts}
                onConfirm={handleConfirmShift}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onMarkComplete={handleMarkJobComplete}
                markingJobId={markingJobId}
              />
              <RecommendedJobsPanel
                jobs={jobsWithDistance}
                guard={guard}
                onApply={handleApplyToJob}
                hasApplied={(jobId) => applications.some(a => (a.jobs as any)?.id === jobId)}
              />
            </div>
            <div className="space-y-6">
              {guard && !isAdmin && (
                <ApplicationTracker
                  applications={applications}
                  planName={guardLimit?.planName || userEntitlement?.plan_name || 'Current'}
                  periodEnd={guardLimit?.periodEnd || userEntitlement?.current_period_end}
                  applicationLimit={guardLimit?.limit || 10}
                  applicationsUsed={guardLimit?.used || applications.length}
                />
              )}
              {guard && guardUserId && (
                <PaymentFlowCard guardId={guard.id} guardUserId={guardUserId} />
              )}
              <EarningsMiniPanel guard={guard} assignments={assignments} />
              <CompliancePanel guard={guard} />
            </div>
          </div>

          {/* Bottom info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {guardUserId && (
              <PlanManagementCard userId={guardUserId} audience="guard" />
            )}
            {guard && !isAdmin && guardLimit && !usageLoading && (
              <UsageLimitWidget
                featureLabel="Job Applications"
                icon="ri-send-plane-line"
                limit={guardLimit.limit}
                used={guardLimit.used}
                remaining={guardLimit.remaining}
                planName={guardLimit.planName || 'Current'}
                periodEnd={guardLimit.periodEnd}
                audience="guard"
              />
            )}
            <MobileQRCodeCard mobileUrl="https://quickguard.uk/guard/mobile" label="QuickGuard Mobile" accentColor="emerald" />
          </div>

          <div id="dashboard-tabs" className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-xl p-4 sm:p-6">
            <div className="flex gap-1 sm:gap-1 border-b border-[#1a2b4a] mb-6 overflow-x-auto scrollbar-none pb-0.5">
              <button onClick={() => setActiveTab('assignments')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg ${activeTab === 'assignments' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Active Jobs ({assignments.length})
              </button>
              <button onClick={() => setActiveTab('upcoming')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg ${activeTab === 'upcoming' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Upcoming ({upcomingJobs.length})
              </button>
              <button onClick={() => setActiveTab('applications')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg ${activeTab === 'applications' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Applied ({applications.length})
              </button>
              <button onClick={() => setActiveTab('responses')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg relative ${activeTab === 'responses' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Responses
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
                )}
              </button>
              <button onClick={() => setActiveTab('available')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg ${activeTab === 'available' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Open Jobs ({availableJobs.length})
              </button>
              <button onClick={() => setActiveTab('reviews')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg flex items-center gap-1 ${activeTab === 'reviews' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Reviews
                {guard?.total_reviews ? (
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold border border-amber-500/25">{guard.total_reviews}</span>
                ) : null}
              </button>
              <button onClick={() => setActiveTab('notifications')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg flex items-center gap-1 ${activeTab === 'notifications' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                History
              </button>
              <button onClick={() => setActiveTab('support')} className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg relative flex items-center gap-1 ${activeTab === 'support' ? 'text-teal-400 bg-teal-500/5 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}>
                Support
                {openTicketCount > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{openTicketCount}</span>
                )}
              </button>
            </div>

            {activeTab === 'assignments' && (
              <div className="space-y-4">
                {assignments.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
                      <i className="ri-briefcase-line text-3xl text-slate-600"></i>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">No Active Jobs</p>
                    <p className="text-xs text-slate-500 mb-4">Browse available jobs and apply to get started</p>
                    <Link href="/guard/jobs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 shadow-lg shadow-teal-500/20 transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-briefcase-line"></i>
                      Browse Jobs
                    </Link>
                  </div>
                ) : (
                  assignments.map(assignment => (
                    <div key={assignment.id} className="border border-[#1a2b4a] rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow bg-[#0B1933]">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                            <h3 className="text-base sm:text-xl font-semibold text-white truncate">{(assignment.jobs as any)?.job_title}</h3>
                            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(assignment.status)}`}>
                              {assignment.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                            <FundedBadge paymentStatus={(assignment.jobs as any)?.payment_status} size="md" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                            <div className="flex items-center gap-2"><i className="ri-map-pin-line text-slate-500"></i><span className="text-slate-300">{(assignment.jobs as any)?.venue_city}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-calendar-line text-slate-500"></i><span className="text-slate-300">{(assignment.jobs as any)?.start_date ? new Date((assignment.jobs as any).start_date).toLocaleDateString() : 'N/A'}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-time-line text-slate-500"></i><span className="text-slate-300">{(assignment.jobs as any)?.start_time} - {(assignment.jobs as any)?.end_time}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line text-slate-500"></i><span className="text-slate-300">{assignment.payment_amount ? `£${Number(assignment.payment_amount).toFixed(2)}` : `£${(assignment.jobs as any)?.hourly_rate}/hr`}</span></div>
                          </div>
                          {assignment.payment_status && (
                            <p className="text-sm text-slate-400 mt-2">Payment: <span className="font-medium text-slate-200">{assignment.payment_status.replace('_', ' ')}</span></p>
                          )}
                        </div>
                        <Link href={`/guard/jobs/${(assignment.jobs as any)?.id}`} className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#162036] whitespace-nowrap">
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'upcoming' && (
              <div className="space-y-4">
                {upcomingJobs.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
                      <i className="ri-calendar-line text-3xl text-slate-600"></i>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">No Upcoming Jobs</p>
                    <p className="text-xs text-slate-500 mb-4">Confirmed jobs with upcoming dates will appear here</p>
                    <Link href="/guard/jobs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 shadow-lg shadow-teal-500/20 transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-briefcase-line"></i>
                      Find Jobs
                    </Link>
                  </div>
                ) : (
                  upcomingJobs.map(job => (
                    <div key={job.id} className="border border-[#1a2b4a] rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow bg-[#0B1933]">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-xl font-semibold text-white mb-2 truncate">{(job.jobs as any)?.job_title}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2"><i className="ri-map-pin-line text-slate-500"></i><span className="text-slate-300">{(job.jobs as any)?.venue_city}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-calendar-line text-slate-500"></i><span className="text-slate-300">{(job.jobs as any)?.start_date ? new Date((job.jobs as any).start_date).toLocaleDateString() : 'N/A'}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-time-line text-slate-500"></i><span className="text-slate-300">{(job.jobs as any)?.start_time} - {(job.jobs as any)?.end_time}</span></div>
                            <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line text-slate-500"></i><span className="text-slate-300">{job.payment_amount ? `£${Number(job.payment_amount).toFixed(2)}` : `£${(job.jobs as any)?.hourly_rate}/hr`}</span></div>
                          </div>
                        </div>
                        <Link href={`/guard/jobs/${(job.jobs as any)?.id}`} className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#162036] whitespace-nowrap">
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <div className="flex gap-1.5 sm:gap-2 mb-6 flex-wrap">
                  {['all', 'pending', 'reviewed', 'accepted', 'declined'].map(status => (
                    <button key={status} onClick={() => setFilterStatus(status)} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === status ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-400 hover:bg-[#1a2b4a]'}`}>
                      {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {filteredApplications.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
                        <i className="ri-inbox-line text-3xl text-slate-600"></i>
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">No Applications Found</p>
                      <p className="text-xs text-slate-500 mb-4">Applications matching this filter will appear here</p>
                    </div>
                  ) : (
                    filteredApplications.map(app => (
                      <div key={app.id} className="border border-[#1a2b4a] rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow bg-[#0B1933]">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                              <h3 className="text-base sm:text-xl font-semibold text-white truncate">{(app.jobs as any)?.job_title}</h3>
                              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(app.status)}`}>
                                {app.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </span>
                            </div>
                            <p className="text-slate-400 mb-3">{(app.jobs as any)?.clients?.company_name || 'Company Name Not Available'}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-2"><i className="ri-map-pin-line text-slate-500"></i><span className="text-slate-300">{(app.jobs as any)?.venue_city}</span></div>
                              <div className="flex items-center gap-2"><i className="ri-calendar-line text-slate-500"></i><span className="text-slate-300">{(app.jobs as any)?.start_date ? new Date((app.jobs as any).start_date).toLocaleDateString() : 'N/A'}</span></div>
                              <div className="flex items-center gap-2"><i className="ri-time-line text-slate-500"></i><span className="text-slate-300">{(app.jobs as any)?.start_time} - {(app.jobs as any)?.end_time}</span></div>
                              <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line text-slate-500"></i><span className="text-slate-300">£{(app.jobs as any)?.hourly_rate}/hr</span></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-3">Applied on {new Date(app.applied_at).toLocaleDateString()}</p>
                          </div>
                          <Link href={`/guard/jobs/${(app.jobs as any)?.id}`} className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#162036] whitespace-nowrap">
                            View Details
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'responses' && (
              <div className="space-y-4">
                {responses.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
                      <i className="ri-mail-line text-3xl text-slate-600"></i>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">No Messages Yet</p>
                    <p className="text-xs text-slate-500">Client responses and job offers will appear here</p>
                  </div>
                ) : (
                  responses.map(response => (
                    <div key={response.id} className={`border rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow ${!response.is_read ? 'bg-teal-500/5 border-teal-500/20' : 'border-[#1a2b4a] bg-[#0B1933]'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${response.response_type === 'job_offer' ? 'bg-emerald-500/15' : response.response_type === 'rejection' ? 'bg-red-500/15' : response.response_type === 'interview_request' ? 'bg-blue-500/15' : 'bg-[#162036]'}`}>
                          <i className={`${getResponseTypeIcon(response.response_type)} text-xl sm:text-2xl ${response.response_type === 'job_offer' ? 'text-emerald-400' : response.response_type === 'rejection' ? 'text-red-400' : response.response_type === 'interview_request' ? 'text-blue-400' : 'text-slate-500'}`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{response.response_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</h3>
                            {!response.is_read && <span className="px-2 py-1 bg-teal-500 text-white text-xs rounded-full">New</span>}
                          </div>
                          <p className="text-sm text-slate-400 mb-2">{response.clients?.company_name || 'Company Name Not Available'} • {response.jobs?.job_title || 'Job Title Not Available'}</p>
                          <p className="text-slate-300 mb-3">{response.message}</p>
                          <p className="text-xs text-slate-500 mb-4">{new Date(response.created_at).toLocaleString()}</p>
                          <div className="flex gap-3">
                            {response.response_type === 'job_offer' && !isAdmin && (
                              <>
                                <button onClick={() => {
                                  const app = applications.find(a => (a.jobs as any)?.id === response.jobs?.id);
                                  if (app) handleAcceptOffer(response.id, app.id);
                                }} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 whitespace-nowrap">Accept Offer</button>
                                <button onClick={() => {
                                  const app = applications.find(a => (a.jobs as any)?.id === response.jobs?.id);
                                  if (app) handleDeclineOffer(response.id, app.id);
                                }} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap">Decline</button>
                              </>
                            )}
                            {!response.is_read && !isAdmin && (
                              <button onClick={() => markAsRead(response.id)} className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#162036] whitespace-nowrap">Mark as Read</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'available' && (
              <div className="space-y-4">
                {jobsWithDistance.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
                      <i className="ri-briefcase-line text-3xl text-slate-600"></i>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">No Open Jobs</p>
                    <p className="text-xs text-slate-500 mb-4">New jobs are posted daily — check back soon</p>
                  </div>
                ) : (
                  <>
                    {jobsWithDistance.map((job, idx) => {
                      const hasApplied = applications.some(app => (app.jobs as any)?.id === job.id);
                      return (
                        <div key={job.id} className="border border-[#1a2b4a] rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow bg-[#0B1933]">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="text-base sm:text-xl font-semibold text-white truncate">{job.job_title}</h3>
                                {job.distanceLabel && (
                                  <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 bg-teal-500/15 text-teal-400 border border-teal-500/25 rounded-full text-[11px] font-semibold">
                                    <i className="ri-map-pin-line text-[10px]"></i>
                                    {job.distanceLabel}
                                  </span>
                                )}
                                {idx === 0 && job.distanceMiles !== null && (
                                  <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full text-[11px] font-semibold">
                                    <i className="ri-star-fill text-[10px]"></i>
                                    Closest
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-400 mb-3">{job.clients?.company_name || 'Company Name Not Available'}</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                <div className="flex items-center gap-2"><i className="ri-map-pin-line text-slate-500"></i><span className="text-slate-300">{job.venue_city}</span></div>
                                <div className="flex items-center gap-2"><i className="ri-calendar-line text-slate-500"></i><span className="text-slate-300">{job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}</span></div>
                                <div className="flex items-center gap-2"><i className="ri-time-line text-slate-500"></i><span className="text-slate-300">{job.start_time} - {job.end_time}</span></div>
                                <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line text-slate-500"></i><span className="text-slate-300">£{job.hourly_rate}/hr</span></div>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Link href={`/guard/jobs/${job.id}`} className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#162036] whitespace-nowrap">View Details</Link>
                              {hasApplied || isAdmin ? (
                                <button disabled className="px-4 py-2 bg-[#162036] text-slate-500 rounded-lg cursor-not-allowed whitespace-nowrap">{isAdmin ? 'Apply Disabled' : 'Already Applied'}</button>
                              ) : (
                                <button onClick={() => handleApplyToJob(job.id)} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 whitespace-nowrap">Apply Now</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {hasMoreAvailableJobs && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={handleLoadMoreAvailable}
                          disabled={loadingMoreJobs}
                          className="px-6 py-3 bg-[#162036] border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#1a2b4a] hover:border-teal-500/20 hover:text-white transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-wait cursor-pointer flex items-center gap-2"
                        >
                          {loadingMoreJobs ? (
                            <>
                              <i className="ri-loader-4-line animate-spin w-4 h-4 flex items-center justify-center"></i>
                              Loading...
                            </>
                          ) : (
                            <>
                              <i className="ri-arrow-down-line"></i>
                              Load More Jobs
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'notifications' && guardUserId && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-slate-500">Full notification history</p>
                  <Link
                    href="/guard/notifications"
                    className="text-xs text-teal-400 font-medium hover:text-teal-300 transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    Open full page
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
                <NotificationHistory guardUserId={guardUserId} />
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-4">
                <div className="border border-[#1a2b4a] rounded-xl p-6 sm:p-10 text-center bg-[#0B1933]">
                  <div className="w-16 h-16 mx-auto mb-4 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20">
                    <i className="ri-customer-service-2-line text-3xl text-teal-400"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {openTicketCount > 0
                      ? `${openTicketCount} open ticket${openTicketCount !== 1 ? 's' : ''} need${openTicketCount === 1 ? 's' : ''} your attention`
                      : 'No open support tickets'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    Track payments, disputes, and account issues from your dedicated Support Centre. Reply to messages and get help faster.
                  </p>
                  <Link href="/guard/support" className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 shadow-lg shadow-teal-500/20 transition-all whitespace-nowrap cursor-pointer">
                    <i className="ri-customer-service-2-line"></i>
                    Open Support Centre
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && guard && (
              <ReviewsTab guardId={guard.id} rating={guard.rating} totalReviews={guard.total_reviews} />
            )}
          </div>
        </div>

        <MobileQuickActions onNavigate={(hash) => {
          const tab = hash.replace('#', '');
          if (tab && ['assignments', 'upcoming', 'applications', 'responses', 'available', 'reviews', 'notifications', 'support'].includes(tab)) {
            setActiveTab(tab);
            const el = document.getElementById('dashboard-tabs');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }} />

        {!isAdmin && guardUserId && featureFlags['guard.advanced_alerts'] && <JobMatchToast guardUserId={guardUserId} />}
        {!isAdmin && <RealtimeToastContainer />}
        {guardToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] bg-[#0d1b36] border border-[#1a2b4a] text-white px-5 py-3 rounded-2xl shadow-2xl shadow-black/40 flex items-center gap-3 animate-in">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-teal-400"></i>
            </div>
            <span className="text-sm font-medium">{guardToast}</span>
          </div>
        )}

        <UpgradeRequiredModal
          featureName={blockedFeatureName}
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          audience="guard"
        />
      </div>
    </div>
  );
}