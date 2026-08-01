"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRouteGuard } from "@/hooks/useRouteGuard";
import { useClientGuard } from "@/hooks/useClientGuard";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getClientDashboardStats, getRecommendedGuards } from "@/lib/client-queries";
import type {
  Client,
  SubscriptionInfo,
  JobStat,
  RecentJobSummary,
  PipelineData,
  BusinessData,
  SafetyCounts,
  ActionData,
  RecommendedGuard,
} from "@/lib/client-types";
import PortalSidebar from "@/components/PortalSidebar";
import NotificationsPanel from "./NotificationsPanel";
import ClientAnnouncements from "./ClientAnnouncements";
import PromoBanner from "@/components/PromoBanner";
import MobileQuickActions from "./MobileQuickActions";
import ActionRequired from "./ActionRequired";
import JobPipeline from "./JobPipeline";
import BusinessOverview from "./BusinessOverview";
import RecentJobs from "./RecentJobs";
import QuickActions from "./QuickActions";
import StatsCard from "./StatsCard";
import ClientPromoCard from "./ClientPromoCard";
import PlanManagementCard from "@/components/PlanManagementCard";
import MobileQRCodeCard from "@/components/MobileQRCodeCard";
import ClientInfoCard from "./ClientInfoCard";
import UpgradePrompt from "@/components/UpgradePrompt";
import SafetyStatsCard from "./SafetyStatsCard";
import OnboardingPanel from "./OnboardingPanel";
import EmptyDashboard from "./EmptyDashboard";
import OnboardingCompletionBadge from "./OnboardingCompletionBadge";
import ContextualHelpCard from "@/app/client/help/ContextualHelpCard";
import { DashboardErrorBanner, PaymentRequiredBanner } from "./DashboardStates";
import { DynamicCompletionApproval, DynamicAnalyticsWidget, DynamicYourTemplates, DynamicRecentActivity, DynamicTopRecommendedGuards, DynamicClientOnboardingAgent } from "./DynamicSections";
import LoadingSkeleton from "@/app/client/components/LoadingSkeleton";
import { hasFeature, ensureEntitlement, CLIENT_FEATURE_KEYS, getAllClientFeaturesFromEntitlement } from "@/lib/entitlements";
import UpgradeRequiredModal from "@/components/billing/UpgradeRequiredModal";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import UsageLimitWidget from "@/components/UsageLimitWidget";
import { getDaysUntil, computeOnboarding } from "@/lib/dashboard-helpers";
import type { OnboardingItem } from "@/lib/dashboard-helpers";



interface UserEntitlement {
  plan_slug: string;
  plan_name: string;
  subscription_status: string;
  is_active: boolean;
  is_free_tier: boolean;
  current_period_end: string;
}

interface ClientDetails {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  business_address: string;
  subscription_tier: string;
  created_at: string;
  verification_status: string;
  client_promo_tier?: string;
  client_signup_number?: number | null;
  client_promo_ends_at?: string | null;
  client_promo_jobs_remaining?: number | null;
  client_lifetime_fee_discount?: number | null;
  founding_client_badge?: boolean;
  onboarding_status?: string;
  profile_completed?: boolean;
  subscription_status?: string;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  stripe_customer_id?: string | null;
  billing_email?: string | null;
  vat_number?: string | null;
  billing_address_line1?: string | null;
  address_line1?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}



export default function ClientDashboardPage() {
  const router = useRouter();
  const { checking, blocked } = useRouteGuard();
  const { loading: authLoading, allowed } = useClientGuard();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [stats, setStats] = useState<JobStat | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoStats, setPromoStats] = useState<any>(null);
  const [globalPromoCounts, setGlobalPromoCounts] = useState<any>(null);
  const [actionData, setActionData] = useState<ActionData>({
    guardsAwaitingReview: 0,
    jobsAwaitingPayment: 0,
    jobsStartingSoon: 0,
    unreadMessages: 0,
    expiringLicences: 0,
    openTickets: 0,
    urgentTickets: 0,
    awaitingReplyTickets: 0,
    pendingGuardConfirmations: 0,
    failedPayments: 0,
    guardsNotCheckedIn: 0,
    lateGuards: 0,
    noShows: 0,
    jobsNeedingReplacement: 0,
    emergencyReplacements: 0,
    replacementRequestsOpen: 0,
    replacementAwaitingApproval: 0,
    replacementUnableToFill: 0,
    cancellationRequestsOpen: 0,
    refundRequestsPending: 0,
    jobsUnderAdminReview: 0,
    cancelledJobsThisMonth: 0,
  });
  const [recentJobs, setRecentJobs] = useState<RecentJobSummary[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineData>({
    draftCount: 0,
    postedCount: 0,
    applicationsCount: 0,
    selectedCount: 0,
    paymentPendingCount: 0,
    activeCount: 0,
    completedCount: 0,
  });
  const [businessData, setBusinessData] = useState<BusinessData>({
    activeJobs: 0,
    totalGuardsHired: 0,
    totalSpendThisMonth: 0,
    averageFillTime: 0,
    completedThisMonth: 0,
  });
  const [recommendedGuards, setRecommendedGuards] = useState<RecommendedGuard[]>([]);
  const [safetyCounts, setSafetyCounts] = useState<SafetyCounts>({
    missingSafetyInfo: 0,
    highRiskJobs: 0,
    complianceWarnings: 0,
    missingEmergencyContacts: 0,
  });
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(0);
  const [onboardingTotal, setOnboardingTotal] = useState(6);
  const [nextAction, setNextAction] = useState<{ label: string; href: string } | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [userEntitlement, setUserEntitlement] = useState<UserEntitlement | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedFeatureName, setBlockedFeatureName] = useState('');
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>();
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const { clientLimit, loading: usageLoading } = useUsageLimits(userId);
  const mountedRef = useRef(true);
  const loadDashboardRef = useRef<(() => Promise<void>) | null>(null);
  const loadingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);

  function traceLog(msg: string, data?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ClientDashboard] ${msg}`, data || '');
      }
    } catch {}
  }

  loadDashboardRef.current = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (mountedRef.current) { setDashboardError(null); setDataWarnings([]); }
    try {
      traceLog('load start');
      const user = await getCurrentUser();
      if (!user) {
        traceLog('no user, redirecting to login');
        if (mountedRef.current) router.push("/client/login");
        return;
      }
      if (!mountedRef.current) return;
      setUserId(user.id);
      traceLog('user loaded', { userId: user.id, email: user.email });

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clientData) {
        traceLog('no client row, redirecting to wizard');
        if (mountedRef.current) router.push("/client/complete-profile-wizard");
        return;
      }
      if (!mountedRef.current) return;

      const cid = clientData.id;
      setClient(clientData as ClientDetails);
      setClientId(cid);
      traceLog('client loaded', { clientId: cid, profile_completed: clientData.profile_completed, onboarding_status: clientData.onboarding_status });

      const warnings: string[] = [];

      const [promoRes, subRes] = await Promise.all([
        supabase.rpc("get_client_promo_stats").then(r => ({ data: r.data, error: r.error })).catch(e => { warnings.push('Promo data failed to load'); return { data: null, error: null }; }),
        Promise.resolve(supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle()).catch(e => { warnings.push('Subscription data failed to load'); return { data: null, error: null }; }),
      ]);

      const [statsResult, topGuardsResult] = await Promise.all([
        getClientDashboardStats(cid, user.id).catch(e => { warnings.push('Dashboard stats failed to load'); return { stats: null, actionData: {}, error: null }; }),
        getRecommendedGuards(5).catch(e => { warnings.push('Recommended guards failed to load'); return { guards: [], error: null }; }),
      ]);

      if (!mountedRef.current) return;

      const entitlementData = await ensureEntitlement(user.id, 'client');
      if (mountedRef.current) setUserEntitlement(entitlementData as UserEntitlement | null);

      const flags: Record<string, boolean> = {};
      try {
        const allFlags = await getAllClientFeaturesFromEntitlement(user.id, entitlementData);
        Object.assign(flags, allFlags);
      } catch {
        for (const key of CLIENT_FEATURE_KEYS) {
          flags[key] = await hasFeature(user.id, key);
        }
      }
      if (mountedRef.current) {
        setFeatureFlags(flags);
        setEntitlementsLoaded(true);
      }

      if (promoRes.data) {
        setPromoStats(promoRes.data);
        setGlobalPromoCounts({
          founding: promoRes.data.counts?.founding ?? 0,
          early: promoRes.data.counts?.early ?? 0,
          launch: promoRes.data.counts?.launch ?? 0,
          caps: promoRes.data.caps ?? { tier1: 50, tier2: 250, tier3: 1000 },
          tier3WindowEnd: promoRes.data.tier3_window_end,
        });
      }

      if (subRes.data) setSubscription(subRes.data as SubscriptionInfo);

      const { stats, actionData: dashActionData, error: statsError } = statsResult;
      if (!statsError) {
        setStats(stats);
        if (dashActionData.actionData) setActionData(dashActionData.actionData as ActionData);
        if (dashActionData.businessData) setBusinessData(dashActionData.businessData as BusinessData);
        if (dashActionData.safetyCounts) setSafetyCounts(dashActionData.safetyCounts as SafetyCounts);
        if (dashActionData.pipelineData) setPipelineData(dashActionData.pipelineData);
        if (dashActionData.recentJobs) setRecentJobs(dashActionData.recentJobs as RecentJobSummary[]);
      }

      if (topGuardsResult.guards) setRecommendedGuards(topGuardsResult.guards as RecommendedGuard[]);

      const [contactsRes, prefsRes] = await Promise.all([
        supabase.from("client_contacts").select("id").eq("client_id", cid),
        supabase.from("notification_preferences").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      const jobsCount = stats?.total_jobs || 0;
      const onboarding = computeOnboarding(
        clientData as ClientDetails,
        contactsRes.data || [],
        prefsRes.data,
        jobsCount,
        subRes.data as SubscriptionInfo || null
      );
      if (mountedRef.current) {
        setOnboardingItems(onboarding.items);
        setOnboardingProgress(onboarding.progress);
        setOnboardingCompleted(onboarding.completedCount);
        setOnboardingTotal(onboarding.totalCount);
        setNextAction(onboarding.nextAction);
        setTrialDaysLeft(onboarding.trialDaysLeft);
        setIsTrialActive(onboarding.isTrialActive);
        setDataWarnings(warnings);
        setLoading(false);
      }
      traceLog('load complete', { warnings: warnings.length, hasJobs: jobsCount > 0 });
    } catch (err) {
      traceLog('load failed', { error: (err as Error).message });
      if (mountedRef.current) {
        setDashboardError('Failed to load dashboard. Please retry or contact support.');
        setLoading(false);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [router, computeOnboarding]);

  const debouncedReload = useCallback(() => {
    if (loadingRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      loadDashboardRef.current?.();
    }, 500);
  }, []);

  const refreshEntitlements = useCallback(async () => {
    if (!userId) return;
    try {
      const entitlementData = await ensureEntitlement(userId, 'client');
      if (mountedRef.current) setUserEntitlement(entitlementData as UserEntitlement | null);

      const flags: Record<string, boolean> = {};
      try {
        const allFlags = await getAllClientFeaturesFromEntitlement(userId, entitlementData);
        Object.assign(flags, allFlags);
      } catch {
        for (const key of CLIENT_FEATURE_KEYS) {
          flags[key] = await hasFeature(userId, key);
        }
      }
      if (mountedRef.current) {
        setFeatureFlags(flags);
        setEntitlementsLoaded(true);
      }
    } catch {}
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    loadDashboardRef.current?.();
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshEntitlements();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshEntitlements]);

  useEffect(() => {
    if (!userId || !clientId) return;

    const channels: any[] = [];

    const entitlementsChannel = supabase
      .channel(`client-dashboard-entitlements-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app',
          table: 'user_entitlements_data',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshEntitlements();
        }
      )
      .subscribe();
    channels.push(entitlementsChannel);

    const jobsChannel = supabase
      .channel(`client-dashboard-jobs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "jobs",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(jobsChannel);

    const assignmentsChannel = supabase
      .channel(`client-dashboard-assignments-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "job_assignments",
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(assignmentsChannel);

    const subsChannel = supabase
      .channel(`client-dashboard-subs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(subsChannel);

    const messagesChannel = supabase
      .channel(`client-dashboard-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(messagesChannel);

    const contactsChannel = supabase
      .channel(`client-dashboard-contacts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "client_contacts",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(contactsChannel);

    const prefsChannel = supabase
      .channel(`client-dashboard-prefs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "notification_preferences",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(prefsChannel);

    const cancellationsChannel = supabase
      .channel(`client-dashboard-cancellations-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "support_tickets",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(cancellationsChannel);

    const refundsChannel = supabase
      .channel(`client-dashboard-refunds-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "app",
          table: "transactions",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();
    channels.push(refundsChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, clientId, debouncedReload]);

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
          <LoadingSkeleton type="stat" rows={8} columns={4} className="w-full max-w-4xl" />
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <UpgradePrompt feature="client.analytics_dashboard" />
        </div>
      </div>
    );
  }

  if (!client) return null;

  const initials = client.company_name
    ? client.company_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CL";

  const hasJobs = (stats?.total_jobs || 0) > 0;
  const onboardingComplete = onboardingProgress >= 100;
  const jobsAwaitingPaymentList = recentJobs.filter(j => j.needs_payment);

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={client.company_name || client.contact_name || "Client"}
        subtitle={client.plan_name || client.subscription_plan || client.subscription_tier || "Free"}
        initials={initials}
        userId={userId}
        featureFlags={featureFlags}
        collapsible={true}
        onUpgradeRequest={(featureName) => {
          setBlockedFeatureName(featureName);
          setShowUpgradeModal(true);
        }}
      />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Welcome back, {client.contact_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/client/post-job"
                onClick={(e) => {
                  if (entitlementsLoaded && !featureFlags['client.post_job']) {
                    e.preventDefault();
                    setBlockedFeatureName('job posting');
                    setShowUpgradeModal(true);
                  }
                }}
                className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-circle-line"></i>
                Post a Job
              </Link>
              {userId && <NotificationsPanel userId={userId} />}
              <UserMenu
                displayName={client.contact_name || client.company_name || "Client"}
                email={client.email}
                initials={initials}
                onSignOut={() => {
                  supabase.auth.signOut().then(() => router.push('/client/login'));
                }}
              />
            </div>
          </div>

          {dashboardError && (
            <DashboardErrorBanner
              message={dashboardError}
              onRetry={() => loadDashboardRef.current?.()}
            />
          )}

          {dataWarnings.length > 0 && !dashboardError && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-amber-400"></i>
              </div>
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium mb-1">Some sections could not load</p>
                <p className="text-xs text-amber-400/80">{dataWarnings.join(' · ')}</p>
              </div>
              <button
                onClick={() => loadDashboardRef.current?.()}
                className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer font-medium flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {jobsAwaitingPaymentList.map(job => (
            <PaymentRequiredBanner key={job.id} jobId={job.id} jobTitle={job.job_title} amount={(job as any).agreed_amount} paymentStatus={(job as any).payment_status} />
          ))}

          <DynamicCompletionApproval clientId={clientId || ''} />

          <ClientAnnouncements />

          <PromoBanner
            clientTier={client?.client_promo_tier}
            signupNumber={client?.client_signup_number}
            promoEndsAt={client?.client_promo_ends_at}
            jobsRemaining={client?.client_promo_jobs_remaining}
            lifetimeDiscount={client?.client_lifetime_fee_discount}
            foundingBadge={client?.founding_client_badge}
            globalCounts={globalPromoCounts}
          />

          <MobileQuickActions />

          {userEntitlement && userEntitlement.is_free_tier && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-vip-crown-line text-xl text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-300">Upgrade your plan to unlock priority job posting, featured company profile and more.</p>
                </div>
              </div>
              <Link href="/pricing" className="self-start sm:self-auto px-4 py-2 bg-teal-500/20 text-teal-400 rounded-lg text-sm font-medium hover:bg-teal-500/30 transition-colors whitespace-nowrap">
                View Plans →
              </Link>
            </div>
          )}

          {userEntitlement && userEntitlement.subscription_status === 'trialing' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-vip-crown-line text-xl text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-300">
                    You're on a free trial until {userEntitlement.current_period_end ? new Date(userEntitlement.current_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'soon'}.
                  </p>
                </div>
              </div>
              <Link href="/client/profile" className="self-start sm:self-auto px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors whitespace-nowrap">
                Manage Subscription →
              </Link>
            </div>
          )}

          {/* Onboarding Section */}
          {!onboardingComplete && showOnboarding && !onboardingDismissed && (
            <OnboardingPanel
              items={onboardingItems}
              progress={onboardingProgress}
              completedCount={onboardingCompleted}
              totalCount={onboardingTotal}
              nextAction={nextAction}
              trialDaysLeft={trialDaysLeft}
              isTrialActive={isTrialActive}
              subscriptionStatus={subscription?.status || "inactive"}
              onDismiss={() => setOnboardingDismissed(true)}
            />
          )}

          {/* Compact onboarding when complete or dismissed */}
          {(onboardingComplete || onboardingDismissed) && (
            <OnboardingPanel
              items={onboardingItems}
              progress={onboardingProgress}
              completedCount={onboardingCompleted}
              totalCount={onboardingTotal}
              nextAction={nextAction}
              trialDaysLeft={trialDaysLeft}
              isTrialActive={isTrialActive}
              subscriptionStatus={subscription?.status || "inactive"}
              onDismiss={() => {}}
              compact={true}
            />
          )}

          {/* Onboarding Completion Badge */}
          {onboardingComplete && (
            <OnboardingCompletionBadge
              progress={onboardingProgress}
              completedCount={onboardingCompleted}
              totalCount={onboardingTotal}
            />
          )}

          {/* Client Onboarding Agent for new clients */}
          <DynamicClientOnboardingAgent
            clientId={clientId}
            hasJobs={hasJobs}
            isFreeOrStarter={userEntitlement?.is_free_tier === true || userEntitlement?.plan_slug === 'starter' || userEntitlement?.plan_slug === 'client_free'}
            profileCompleted={!!client?.profile_completed}
            page="dashboard"
          />

          {/* Contextual Help Card for new clients */}
          {!hasJobs && (
            <ContextualHelpCard
              title="What should I do first?"
              tip="Start by completing your company profile, then post your first security job. Verified SIA-licensed guards will apply within hours. You can review applicants, select guards, and pay securely — all in one place."
              learnMoreHref="/client/help"
              learnMoreLabel="View full guide"
              icon="ri-lightbulb-flash-line"
            />
          )}

          {/* Empty Dashboard State */}
          {!hasJobs && !dashboardError && (
            <EmptyDashboard
              onPostJob={() => router.push("/client/post-job")}
              onCompleteProfile={() => router.push("/client/profile")}
              onContactSupport={() => router.push("/client/support")}
              isTrialActive={isTrialActive}
              trialDaysLeft={trialDaysLeft}
            />
          )}

          <ActionRequired
            guardsAwaitingReview={actionData.guardsAwaitingReview}
            jobsAwaitingPayment={actionData.jobsAwaitingPayment}
            jobsStartingSoon={actionData.jobsStartingSoon}
            unreadMessages={actionData.unreadMessages}
            expiringLicences={actionData.expiringLicences}
            openTickets={actionData.openTickets}
            urgentTickets={actionData.urgentTickets}
            awaitingReplyTickets={actionData.awaitingReplyTickets}
            pendingGuardConfirmations={actionData.pendingGuardConfirmations}
            failedPayments={actionData.failedPayments}
            guardsNotCheckedIn={actionData.guardsNotCheckedIn}
            lateGuards={actionData.lateGuards}
            noShows={actionData.noShows}
            jobsNeedingReplacement={actionData.jobsNeedingReplacement}
            emergencyReplacements={actionData.emergencyReplacements}
            replacementRequestsOpen={actionData.replacementRequestsOpen}
            replacementAwaitingApproval={actionData.replacementAwaitingApproval}
            replacementUnableToFill={actionData.replacementUnableToFill}
            cancellationRequestsOpen={actionData.cancellationRequestsOpen}
            refundRequestsPending={actionData.refundRequestsPending}
            jobsUnderAdminReview={actionData.jobsUnderAdminReview}
            cancelledJobsThisMonth={actionData.cancelledJobsThisMonth}
          />

          <JobPipeline
            draftCount={pipelineData.draftCount}
            postedCount={pipelineData.postedCount}
            applicationsCount={pipelineData.applicationsCount}
            selectedCount={pipelineData.selectedCount}
            paymentPendingCount={pipelineData.paymentPendingCount}
            activeCount={pipelineData.activeCount}
            completedCount={pipelineData.completedCount}
          />

          <BusinessOverview
            activeJobs={businessData.activeJobs}
            totalGuardsHired={businessData.totalGuardsHired}
            totalSpendThisMonth={businessData.totalSpendThisMonth}
            averageFillTime={businessData.averageFillTime}
            completedThisMonth={businessData.completedThisMonth}
          />

          {hasJobs && clientId && (
            <div className="mb-8">
              <DynamicAnalyticsWidget clientId={clientId} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <DynamicRecentActivity clientId={clientId || ''} />
              <RecentJobs jobs={recentJobs} />
              <DynamicYourTemplates clientId={clientId || ''} />
              <QuickActions />
            </div>
            <div className="space-y-4 sm:space-y-6">
              <StatsCard
                icon="ri-briefcase-4-line"
                iconBg="bg-blue-500/15"
                iconColor="text-blue-400"
                value={stats?.total_jobs || 0}
                label="Total Jobs"
                sub={`${stats?.active_jobs || 0} active`}
                subColor="text-blue-400"
                href="/client/jobs"
              />
              <StatsCard
                icon="ri-shield-user-line"
                iconBg="bg-emerald-500/15"
                iconColor="text-emerald-400"
                value={stats?.completed_jobs || 0}
                label="Completed"
                sub="All time"
                subColor="text-emerald-400"
                href="/client/jobs"
              />
              <StatsCard
                icon="ri-wallet-3-line"
                iconBg="bg-violet-500/15"
                iconColor="text-violet-400"
                value={stats?.pending_payments || 0}
                label="Pending Payments"
                sub="Awaiting invoice"
                subColor="text-violet-400"
                href="/client/payment-history"
              />
              <StatsCard
                icon="ri-calendar-check-line"
                iconBg="bg-amber-500/15"
                iconColor="text-amber-400"
                value={stats?.active_jobs || 0}
                label="Active Jobs"
                sub="Currently open"
                subColor="text-amber-400"
                href="/client/jobs/tracker"
              />
              <StatsCard
                icon="ri-pulse-line"
                iconBg="bg-emerald-500/15"
                iconColor="text-emerald-400"
                value={actionData.guardsNotCheckedIn + actionData.lateGuards + actionData.noShows}
                label="Attendance Issues"
                sub={actionData.guardsNotCheckedIn > 0 ? `${actionData.guardsNotCheckedIn} not checked in` : actionData.lateGuards > 0 ? `${actionData.lateGuards} late` : actionData.noShows > 0 ? `${actionData.noShows} no-show` : 'All good'}
                subColor="text-emerald-400"
                href="/client/jobs/tracker"
              />
              <StatsCard
                icon="ri-refresh-line"
                iconBg="bg-violet-500/15"
                iconColor="text-violet-400"
                value={actionData.replacementRequestsOpen}
                label="Replacement Requests"
                sub={actionData.emergencyReplacements > 0 ? `${actionData.emergencyReplacements} emergency` : actionData.replacementAwaitingApproval > 0 ? `${actionData.replacementAwaitingApproval} awaiting approval` : actionData.replacementUnableToFill > 0 ? `${actionData.replacementUnableToFill} unable to fill` : 'All good'}
                subColor="text-violet-400"
                href="/client/jobs/tracker"
              />
              <StatsCard
                icon="ri-close-circle-line"
                iconBg="bg-red-500/15"
                iconColor="text-red-400"
                value={actionData.cancellationRequestsOpen}
                label="Cancellation Requests"
                sub={actionData.cancelledJobsThisMonth > 0 ? `${actionData.cancelledJobsThisMonth} this month` : 'No cancellations'}
                subColor="text-red-400"
                href="/client/jobs"
              />
              <StatsCard
                icon="ri-refund-line"
                iconBg="bg-violet-500/15"
                iconColor="text-violet-400"
                value={actionData.refundRequestsPending}
                label="Refund Requests"
                sub={actionData.refundRequestsPending > 0 ? `${actionData.refundRequestsPending} pending` : 'All resolved'}
                subColor="text-violet-400"
                href="/client/support"
              />
              <StatsCard
                icon="ri-shield-user-line"
                iconBg="bg-blue-500/15"
                iconColor="text-blue-400"
                value={actionData.jobsUnderAdminReview}
                label="Under Admin Review"
                sub={actionData.jobsUnderAdminReview > 0 ? `${actionData.jobsUnderAdminReview} pending review` : 'All clear'}
                subColor="text-blue-400"
                href="/client/support"
              />
              <SafetyStatsCard
                missingSafetyInfo={safetyCounts.missingSafetyInfo}
                highRiskJobs={safetyCounts.highRiskJobs}
                complianceWarnings={safetyCounts.complianceWarnings}
                missingEmergencyContacts={safetyCounts.missingEmergencyContacts}
              />
              {featureFlags['client.advanced_matching'] !== false && <DynamicTopRecommendedGuards guards={recommendedGuards} />}
              <ClientPromoCard />
              {!usageLoading && clientLimit && (
                <UsageLimitWidget
                  featureLabel="Job Posts"
                  icon="ri-briefcase-line"
                  limit={clientLimit.limit}
                  used={clientLimit.used}
                  remaining={clientLimit.remaining}
                  planName={clientLimit.planName || 'Current'}
                  periodEnd={clientLimit.periodEnd}
                  audience="client"
                />
              )}
              <PlanManagementCard
                userId={userId || ""}
                audience="client"
              />
              <MobileQRCodeCard
                mobileUrl="https://quickguard.uk/client/mobile"
                label="View on Mobile"
                accentColor="teal"
              />
              <ClientInfoCard client={client} />
            </div>
          </div>
        </div>
      </main>
      {/* Upgrade Required Modal */}
      <UpgradeRequiredModal
        featureName={blockedFeatureName}
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        audience="client"
      />
    </div>
  );
}

function UserMenu({ displayName, email, initials, onSignOut }: { displayName: string; email: string; initials: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl hover:bg-[#162036] transition-colors cursor-pointer px-2 py-1.5 border border-transparent hover:border-[#1a2b4a]"
      >
        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10">
          {initials.slice(0, 2)}
        </div>
        <span className="hidden sm:inline text-sm text-slate-300 font-medium">{displayName}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`ri-arrow-down-s-line text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2b4a]">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
          <div className="py-1">
            <Link href="/client/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors cursor-pointer">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-user-settings-line text-slate-400"></i></div>
              Profile & Settings
            </Link>
            <Link href="/client/help" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors cursor-pointer">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-question-answer-line text-slate-400"></i></div>
              Help Centre
            </Link>
          </div>
          <div className="border-t border-[#1a2b4a] py-1">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-r-line"></i></div>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}