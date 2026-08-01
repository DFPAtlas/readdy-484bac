'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPlansForAudience, getActivePlan } from '@/lib/entitlements';
import NavSidebar from '@/components/NavSidebar';

const clientFeatureLabels: Record<string, string> = {
  'client.post_job': 'Job Posting',
  'client.view_guard_profiles': 'View Guard Profiles',
  'client.escrow_payments': 'Held Job Payments with Stripe',
  'client.advanced_matching': 'Advanced Guard Matching',
  'client.priority_support': 'Priority Support',
  'client.job_templates': 'Job Templates',
  'client.analytics_dashboard': 'Analytics Dashboard',
  'client.direct_contact': 'Direct Guard Contact',
  'client.unlimited_jobs': 'Unlimited Jobs',
  'client.bulk_posting': 'Bulk Job Posting',
  'client.multi_site': 'Multi-Site Management',
  'client.team_access': 'Team Access',
  'client.custom_contracts': 'Custom Contracts',
  'client.api_access': 'API Access',
  'client.job_history': 'Job History',
  'client.job_tracker': 'Live Job Tracker',
};

const guardFeatureLabels: Record<string, string> = {
  'guard.apply_job': 'Job Applications',
  'guard.view_jobs': 'View Jobs',
  'guard.create_profile': 'Create Guard Profile',
  'guard.advanced_alerts': 'Advanced Job Alerts',
  'guard.priority_profile': 'Priority Profile',
  'guard.profile_boost': 'Profile Boost',
  'guard.performance_analytics': 'Performance Analytics',
  'guard.priority_support': 'Priority Support',
  'guard.direct_contact': 'Direct Contact',
  'guard.unlimited_applications': 'Unlimited Applications',
  'guard_application_limit_reached': 'Monthly Application Limit Reached',
  'guard.plan_verification_failed': 'Plan Verification Failed',
  'job_limit_reached': 'Monthly Job Posting Limit Reached',
};

const FEATURE_RECOMMENDED_PLAN: Record<string, string> = {
  'client.post_job': 'client_free',
  'client.view_guard_profiles': 'client_free',
  'client.escrow_payments': 'client_free',
  'client.advanced_matching': 'client-pro',
  'client.priority_support': 'client-pro',
  'client.job_templates': 'client-pro',
  'client.analytics_dashboard': 'client-pro',
  'client.direct_contact': 'client-pro',
  'client.unlimited_jobs': 'client-enterprise',
  'client.bulk_posting': 'client-enterprise',
  'client.multi_site': 'client-enterprise',
  'client.team_access': 'client-enterprise',
  'client.custom_contracts': 'client-enterprise',
  'client.api_access': 'client-enterprise',
  'client.job_history': 'client-pro',
  'client.job_tracker': 'client-pro',
  'guard.apply_job': 'guard_starter',
  'guard.view_jobs': 'guard_starter',
  'guard.create_profile': 'guard_starter',
  'guard.advanced_alerts': 'guard_starter',
  'guard.priority_profile': 'guard-pro',
  'guard.profile_boost': 'guard-pro',
  'guard.performance_analytics': 'guard-pro',
  'guard.priority_support': 'guard-pro',
  'guard.direct_contact': 'guard-pro',
  'guard.unlimited_applications': 'guard-elite',
  'guard_application_limit_reached': 'guard-basic',
  'guard.plan_verification_failed': 'guard-basic',
  'job_limit_reached': 'client-starter',
};

const FEATURE_UNLOCK_MESSAGE: Record<string, string> = {
  'client.post_job': 'Free Starter and above',
  'client.view_guard_profiles': 'Free Starter and above',
  'client.escrow_payments': 'Free Starter, Starter, Pro, and Enterprise',
  'client.advanced_matching': 'Client Pro or Client Enterprise',
  'client.priority_support': 'Client Pro or Client Enterprise',
  'client.job_templates': 'Client Pro or Client Enterprise',
  'client.analytics_dashboard': 'Client Pro or Client Enterprise',
  'client.direct_contact': 'Client Pro or Client Enterprise',
  'client.unlimited_jobs': 'Client Enterprise',
  'client.bulk_posting': 'Client Enterprise',
  'client.multi_site': 'Client Enterprise',
  'client.team_access': 'Client Enterprise',
  'client.custom_contracts': 'Client Enterprise',
  'client.api_access': 'Client Enterprise',
  'client.job_history': 'Client Pro or Client Enterprise',
  'client.job_tracker': 'Client Pro or Client Enterprise',
  'guard.apply_job': 'Guard Starter and above',
  'guard.view_jobs': 'Guard Starter and above',
  'guard.create_profile': 'Guard Starter and above',
  'guard.advanced_alerts': 'Guard Starter, Guard Pro, or Guard Elite',
  'guard.priority_profile': 'Guard Pro or Guard Elite',
  'guard.profile_boost': 'Guard Pro or Guard Elite',
  'guard.performance_analytics': 'Guard Pro or Guard Elite',
  'guard.priority_support': 'Guard Pro or Guard Elite',
  'guard.direct_contact': 'Guard Pro or Guard Elite',
  'guard.unlimited_applications': 'Guard Elite',
  'job_limit_reached': 'Client Starter, Client Pro, or Client Enterprise',
};

const FEATURE_BENEFITS: Record<string, { title: string; desc: string; points: { icon: string; label: string; detail: string }[] }> = {
  'client.advanced_matching': {
    title: 'Why upgrade to Advanced Matching?',
    desc: 'Stop scrolling through irrelevant applications. Let our matching engine find the best guards for your jobs automatically.',
    points: [
      { icon: 'ri-user-search-line', label: 'Smart Filtering', detail: 'Match guards by licence type, experience level, location proximity, and past performance ratings.' },
      { icon: 'ri-flashlight-line', label: 'Instant Shortlists', detail: 'Get a ranked shortlist of the top 5 guards within minutes of posting a job.' },
      { icon: 'ri-history-line', label: 'Repeat Booking Recognition', detail: 'System prioritises guards you have booked before and rated highly, saving you time.' },
      { icon: 'ri-shield-check-line', detail: 'Compliance Auto-Check', label: 'Each matched guard is automatically verified for valid SIA licence and right-to-work before appearing.' },
      { icon: 'ri-bar-chart-2-line', label: 'Match Quality Score', detail: 'Every match includes a quality score so you can see exactly why a guard was recommended.' },
    ],
  },
  'client.job_templates': {
    title: 'Why upgrade to Job Templates?',
    desc: 'Posting the same type of job over and over? Templates turn 15 minutes of form-filling into 30 seconds.',
    points: [
      { icon: 'ri-file-copy-line', label: 'One-Click Posting', detail: 'Save your common job specs as templates — post them again with a single click.' },
      { icon: 'ri-stack-line', label: 'Unlimited Templates', detail: 'Create templates for every venue, shift pattern, and licence requirement you regularly need.' },
      { icon: 'ri-edit-line', label: 'Quick Edits', detail: 'Load a template, tweak the date or pay rate, and post. No re-typing required.' },
      { icon: 'ri-team-line', label: 'Team Sharing', detail: 'Share templates with your team so everyone posts jobs with consistent specs and pricing.' },
    ],
  },
  'client.analytics_dashboard': {
    title: 'Why upgrade to the Analytics Dashboard?',
    desc: 'Get full visibility into your security operations. Know what is working, what is not, and where your money goes.',
    points: [
      { icon: 'ri-bar-chart-grouped-line', label: 'Job Performance Dashboard', detail: 'Track fill rates, guard response times, and completion rates across all your postings.' },
      { icon: 'ri-pie-chart-line', label: 'Cost Breakdown Reports', detail: 'See exactly where your security spend goes — hourly rates, fees, and guard payouts per shift.' },
      { icon: 'ri-map-2-line', label: 'Location Insights', detail: 'Visualise job coverage across sites, hotspots, and guard travel distances.' },
      { icon: 'ri-time-line', label: 'Uptime & Reliability Tracking', detail: 'Monitor guard attendance, punctuality, and incident rates in real time.' },
      { icon: 'ri-user-follow-line', label: 'Guard Quality Scores', detail: 'Compare guard ratings and repeat booking rates to build your best roster.' },
      { icon: 'ri-download-cloud-2-line', label: 'Exportable Reports', detail: 'Download PDF or CSV reports for your accounts, audits, or board packs.' },
    ],
  },
  'client.direct_contact': {
    title: 'Why upgrade to Direct Guard Contact?',
    desc: 'Skip the middleman. Message guards directly to brief them, confirm availability, or handle last-minute changes.',
    points: [
      { icon: 'ri-message-3-line', label: 'Real-Time Chat', detail: 'Message assigned guards instantly for shift briefings, uniform requirements, or access codes.' },
      { icon: 'ri-notification-3-line', label: 'Instant Alerts', detail: 'Get notified the moment a guard confirms, cancels, or messages you about a job.' },
      { icon: 'ri-file-text-line', label: 'Briefing Attachments', detail: 'Send site maps, risk assessments, or entry instructions directly through chat.' },
      { icon: 'ri-history-line', label: 'Conversation History', detail: 'Every conversation is saved so you have a clear record of instructions and confirmations.' },
    ],
  },
  'client.priority_support': {
    title: 'Why upgrade to Priority Support?',
    desc: 'When things go wrong at 2 AM, you need answers fast. Priority support means you skip the queue.',
    points: [
      { icon: 'ri-customer-service-2-line', label: 'Dedicated Support Line', detail: 'A named point of contact who knows your account and your venues.' },
      { icon: 'ri-timer-flash-line', label: 'Fast-Track Resolution', detail: 'Priority tickets are answered within 2 hours during business hours, not 24.' },
      { icon: 'ri-phone-line', label: 'Phone Support', detail: 'Call us directly for urgent issues like no-show guards or payment problems.' },
      { icon: 'ri-shield-user-line', label: 'Emergency Guard Replacement', detail: 'Priority access to replacement guards if someone does not show up.' },
    ],
  },
  'client.multi_site': {
    title: 'Why upgrade to Multi-Site Management?',
    desc: 'Running security across multiple venues? Manage them all from one dashboard instead of juggling spreadsheets.',
    points: [
      { icon: 'ri-building-line', label: 'Unified Site View', detail: 'See all your venues, active guards, and upcoming shifts on a single screen.' },
      { icon: 'ri-map-pin-line', label: 'Site Profiles', detail: 'Store site-specific details — access codes, risk levels, required licences — so you never repeat yourself.' },
      { icon: 'ri-swap-line', label: 'Cross-Site Guard Sharing', detail: 'Move guards between your venues when one site is overstaffed and another is short.' },
      { icon: 'ri-file-chart-line', label: 'Per-Site Analytics', detail: 'Compare performance, spend, and incident rates across every location.' },
    ],
  },
  'client.unlimited_jobs': {
    title: 'Why upgrade to Unlimited Jobs?',
    desc: 'Stop counting posts. Post as many jobs as you need without worrying about hitting a monthly cap.',
    points: [
      { icon: 'ri-add-circle-line', label: 'No Monthly Cap', detail: 'Post jobs freely — 10, 50, 200 — whatever your business needs each month.' },
      { icon: 'ri-money-pound-circle-line', label: 'Lower Per-Job Cost', detail: 'As your volume grows, your effective cost per job drops significantly compared to capped plans.' },
      { icon: 'ri-calendar-line', label: 'Bulk Scheduling', detail: 'Schedule an entire month of shifts in one go without hitting a posting limit.' },
    ],
  },
  'client.bulk_posting': {
    title: 'Why upgrade to Bulk Posting?',
    desc: 'Need 30 guards for a festival or 10 for a weekend event? Post them all at once, not one by one.',
    points: [
      { icon: 'ri-stack-line', label: 'Multi-Job Upload', detail: 'Upload a CSV or fill a grid to create dozens of jobs in seconds.' },
      { icon: 'ri-calendar-check-line', label: 'Date Range Expansion', detail: 'Set a start date, end date, and shift pattern — the system generates all the individual posts.' },
      { icon: 'ri-dashboard-line', label: 'Bulk Management', detail: 'Approve, edit, or cancel multiple jobs from a single screen.' },
    ],
  },
  'client.team_access': {
    title: 'Why upgrade to Team Access?',
    desc: 'Let your ops manager, site supervisors, and HR team collaborate on QuickGuard with their own logins.',
    points: [
      { icon: 'ri-team-line', label: 'Role-Based Access', detail: 'Admin, manager, and viewer roles so each team member sees only what they need.' },
      { icon: 'ri-shield-user-line', label: 'Audit Trail', detail: 'Every action is logged — who posted a job, who approved a guard, who authorised a payment.' },
      { icon: 'ri-notification-3-line', label: 'Shared Alerts', detail: 'Team members get notified about job confirmations, cancellations, and payment issues.' },
    ],
  },
  'client.custom_contracts': {
    title: 'Why upgrade to Custom Contracts?',
    desc: 'Standard terms do not fit every business. Attach your own contract terms to job postings.',
    points: [
      { icon: 'ri-file-text-line', label: 'Custom Terms', detail: 'Upload your own contract template once — it attaches automatically to every job you post.' },
      { icon: 'ri-check-double-line', label: 'Digital Acceptance', detail: 'Guards must accept your terms before they can be assigned to your jobs.' },
      { icon: 'ri-shield-check-line', label: 'Legal Compliance', detail: 'Ensure all engagements meet your insurance and liability requirements.' },
    ],
  },
  'client.api_access': {
    title: 'Why upgrade to API Access?',
    desc: 'Integrate QuickGuard directly into your own systems — HR platforms, scheduling tools, or internal dashboards.',
    points: [
      { icon: 'ri-code-s-slash-line', label: 'Full REST API', detail: 'Programmatically create jobs, fetch guard lists, and retrieve reports.' },
      { icon: 'ri-plug-line', label: 'Webhook Support', detail: 'Receive real-time events when guards are assigned, complete shifts, or cancel.' },
      { icon: 'ri-key-2-line', label: 'Secure API Keys', detail: 'Rotate keys, set IP allowlists, and monitor usage from your dashboard.' },
    ],
  },
  'client.job_history': {
    title: 'Why upgrade to Job History?',
    desc: 'See your complete booking archive — every job, every guard, every payment across the entire history of your account.',
    points: [
      { icon: 'ri-history-line', label: 'Full Archive', detail: 'Access every job you have ever posted with guard details, payments, and timestamps.' },
      { icon: 'ri-search-line', label: 'Search & Filter', detail: 'Find any past job by date, venue, guard name, or status in seconds.' },
      { icon: 'ri-download-line', label: 'Export Records', detail: 'Download job history as CSV for your accounting or compliance records.' },
    ],
  },
  'client.job_tracker': {
    title: 'Why upgrade to Job Tracker?',
    desc: 'Real-time visibility into every active job — know who is on site, who is running late, and who has checked out.',
    points: [
      { icon: 'ri-radar-line', label: 'Live Status Board', detail: 'See every active job with real-time guard check-in, break, and check-out status.' },
      { icon: 'ri-map-pin-line', label: 'GPS Verification', detail: 'Confirm guards are at the right location with geolocation check-in and check-out.' },
      { icon: 'ri-alert-line', label: 'No-Show Alerts', detail: 'Get immediate alerts if a guard does not check in within 15 minutes of shift start.' },
      { icon: 'ri-timer-line', label: 'Attendance Reports', detail: 'Weekly reports showing punctuality, early departures, and total hours per guard.' },
    ],
  },
  'guard.advanced_alerts': {
    title: 'Why upgrade to Advanced Job Alerts?',
    desc: 'Get notified the moment a job matching your profile is posted — before other guards even see it.',
    points: [
      { icon: 'ri-notification-3-line', label: 'Instant Push Notifications', detail: 'Receive alerts on your phone the second a matching job goes live.' },
      { icon: 'ri-filter-line', label: 'Custom Alert Filters', detail: 'Set alerts by postcode radius, pay rate minimum, licence type, and shift length.' },
      { icon: 'ri-flashlight-line', label: 'First-Mover Advantage', detail: 'Apply before the job fills up — many Pro jobs are filled within the first hour.' },
    ],
  },
  'guard.priority_profile': {
    title: 'Why upgrade to Priority Profile?',
    desc: 'Get your profile seen first. Priority profiles appear at the top of client search results and get more bookings.',
    points: [
      { icon: 'ri-arrow-up-circle-line', label: 'Top of Search Results', detail: 'Your profile ranks above non-priority guards when clients search by postcode or licence.' },
      { icon: 'ri-eye-line', label: 'Featured Profile Badge', detail: 'A verified badge on your profile signals trust and quality to clients browsing guards.' },
      { icon: 'ri-bar-chart-2-line', label: 'Profile Performance Stats', detail: 'See how many clients viewed your profile, how often you appear in searches, and your booking conversion rate.' },
    ],
  },
  'guard.profile_boost': {
    title: 'Why upgrade to Profile Boost?',
    desc: 'Get an extra visibility push. Boosted profiles appear in a dedicated featured section clients cannot miss.',
    points: [
      { icon: 'ri-rocket-line', label: 'Featured Placement', detail: 'Your profile appears in the Featured Guards carousel on the client dashboard.' },
      { icon: 'ri-thumb-up-line', label: 'Higher Booking Rate', detail: 'Boosted guards receive on average 3x more booking invitations than non-boosted profiles.' },
      { icon: 'ri-refresh-line', label: 'Weekly Boost Refresh', detail: 'Your boost refreshes weekly so your profile stays visible to new clients.' },
    ],
  },
  'guard.performance_analytics': {
    title: 'Why upgrade to Performance Analytics?',
    desc: 'Understand your earning patterns, booking trends, and client ratings to maximise your income.',
    points: [
      { icon: 'ri-line-chart-line', label: 'Earnings Dashboard', detail: 'Track monthly earnings, average hourly rate, and year-on-year growth.' },
      { icon: 'ri-star-line', label: 'Rating Insights', detail: 'See what clients say, identify patterns, and improve your profile to attract better jobs.' },
      { icon: 'ri-calendar-check-line', label: 'Booking Trends', detail: 'Know which days, venues, and shift types book you most so you can optimise availability.' },
    ],
  },
  'guard.priority_support': {
    title: 'Why upgrade to Priority Support?',
    desc: 'Get fast help when you need it — payment issues, client disputes, or licence verification questions.',
    points: [
      { icon: 'ri-customer-service-2-line', label: 'Priority Queue', detail: 'Your support tickets jump to the front of the queue.' },
      { icon: 'ri-phone-line', label: 'Phone Support', detail: 'Call us directly for urgent issues related to payments or job disputes.' },
    ],
  },
  'guard.direct_contact': {
    title: 'Why upgrade to Direct Contact?',
    desc: 'Message clients directly to ask questions, confirm details, or build relationships for repeat bookings.',
    points: [
      { icon: 'ri-message-3-line', label: 'Client Messaging', detail: 'Chat with clients before accepting a job to clarify expectations and requirements.' },
      { icon: 'ri-user-heart-line', label: 'Build Relationships', detail: 'Clients can favourite you and invite you directly to future jobs.' },
    ],
  },
  'guard.unlimited_applications': {
    title: 'Why upgrade to Unlimited Applications?',
    desc: 'Apply to as many jobs as you want. No monthly caps, no throttling — just maximum opportunity.',
    points: [
      { icon: 'ri-infinity-line', label: 'No Application Limits', detail: 'Apply to every job that fits your schedule and preferences without worrying about caps.' },
      { icon: 'ri-money-pound-circle-line', label: 'Maximise Earnings', detail: 'More applications mean more bookings. Elite guards book 40% more shifts on average.' },
    ],
  },
};

const planDescriptions: Record<string, string> = {
  'client_free': 'For trying out QuickGuard with basic job posting',
  'client-starter': 'For small businesses with regular security needs',
  'client-pro': 'For growing companies with high-volume needs',
  'client-enterprise': 'For multi-site and enterprise security needs',
  'guard_starter': 'Free starter plan for new guards',
  'guard-basic': 'Perfect for getting started',
  'guard-pro': 'For active security professionals',
  'guard-elite': 'Full access to all features',
};

const planBadges: Record<string, string> = {
  'client-pro': 'POPULAR',
  'guard-elite': 'MOST POPULAR',
};

const planLimitations: Record<string, string[]> = {
  'client_free': ['Limited to 1 job per month', 'Upgrade required for advanced matching', 'Upgrade required for job templates', 'Upgrade required for analytics dashboard', 'Upgrade required for direct contact', 'Upgrade required for multi-site features'],
  'client-starter': ['Limited to 10 jobs per month', 'No priority matching', 'No dedicated support'],
  'client-pro': ['Limited to 30 jobs per month', 'No dedicated account manager', 'No bulk posting'],
  'guard_starter': ['Limited to 1 application/month', 'No advanced job alerts', 'No performance analytics', 'No priority support'],
  'guard-basic': ['Limited to 10 applications/month', 'No advanced job alerts', 'No performance analytics', 'No priority support'],
  'guard-pro': ['Limited to 25 applications/month'],
};

const getFeatureLabel = (key: string, audience: string) => {
  if (audience === 'client' && clientFeatureLabels[key]) return clientFeatureLabels[key];
  if (audience === 'guard' && guardFeatureLabels[key]) return guardFeatureLabels[key];
  return key.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || key;
};

function UpgradeContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || '';
  const preselectedPlan = searchParams.get('plan') || '';

  const [audience, setAudience] = useState<'client' | 'guard' | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [confirmSwitch, setConfirmSwitch] = useState<any>(null);
  const [switchSuccess, setSwitchSuccess] = useState<{ oldPlanName: string; newPlanName: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(0);

  const isKnownFeature = reason && (clientFeatureLabels[reason] || guardFeatureLabels[reason]);
  const featureName = reason ? getFeatureLabel(reason, audience || 'client') : '';
  const recommendedPlan = FEATURE_RECOMMENDED_PLAN[reason] || preselectedPlan;
  const unlockMessage = FEATURE_UNLOCK_MESSAGE[reason] || '';

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase.from('users').select('user_type').eq('id', user.id).maybeSingle();
        const aud = userData?.user_type === 'client' || userData?.user_type === 'guard' ? userData.user_type : null;
        setAudience(aud);

        if (aud) {
          const p = await getPlansForAudience(aud);
          const enriched = p.map((plan: any) => ({
            ...plan,
            description: planDescriptions[plan.slug] || '',
            badge: planBadges[plan.slug] || undefined,
            limitations: planLimitations[plan.slug] || undefined,
          }));
          setPlans(enriched);
        } else {
          const { data } = await supabase
            .from('plans')
            .select('*')
            .eq('active', true)
            .order('audience', { ascending: true })
            .order('monthly_price_pence', { ascending: true });
          const enriched = (data || []).map((plan: any) => ({
            ...plan,
            description: planDescriptions[plan.slug] || '',
            badge: planBadges[plan.slug] || undefined,
            limitations: planLimitations[plan.slug] || undefined,
          }));
          setPlans(enriched);
        }

        const cp = await getActivePlan(user.id);
        setCurrentPlan(cp);
      } else {
        const { data } = await supabase
          .from('plans')
          .select('*')
          .eq('active', true)
          .order('audience', { ascending: true })
          .order('monthly_price_pence', { ascending: true });
        const enriched = (data || []).map((plan: any) => ({
          ...plan,
          description: planDescriptions[plan.slug] || '',
          badge: planBadges[plan.slug] || undefined,
          limitations: planLimitations[plan.slug] || undefined,
        }));
        setPlans(enriched);
      }

      setLoading(false);
    };
    load();
  }, [reason]);

  useEffect(() => {
    if (redirectCountdown <= 0) return;
    const timer = setTimeout(() => {
      if (redirectCountdown === 1) {
        window.location.href = audience === 'guard' ? '/guard/dashboard' : '/client/dashboard';
      } else {
        setRedirectCountdown(prev => prev - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, audience]);

  const handleSubscribe = async (plan: any) => {
    if (plan.monthly_price_pence === 0) {
      alert('This is a free plan and does not require Stripe checkout.');
      return;
    }

    if (currentPlan && !currentPlan.is_free_tier && plan.slug !== currentPlan.plan_slug) {
      setConfirmSwitch({
        plan,
        currentPlanName: currentPlan.plan_name,
        currentPlanSlug: currentPlan.plan_slug,
      });
      return;
    }

    await executeSubscribe(plan);
  };

  const executeSubscribe = async (plan: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = plan.audience === 'guard' ? '/guard/register' : '/client/register';
      return;
    }

    setSubscribing(plan.slug);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        alert('Your session has expired. Please log in again.');
        setSubscribing(null);
        return;
      }

      const basePath = window.location.pathname.replace(/\/(pricing|upgrade).*$/, '');
      const siteUrl = window.location.origin + basePath;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-subscription-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            accountType: plan.audience,
            planId: plan.slug,
            billingCycle,
            siteUrl,
          }),
        }
      );
      const data = await response.json();
      if (data.switched) {
        setConfirmSwitch(null);
        setSwitchSuccess({ oldPlanName: data.oldPlanName || 'previous plan', newPlanName: data.newPlanName || plan.name });
        setRedirectCountdown(3);
      } else if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert(data.error || 'Payment setup failed. Please try again.');
      }
    } catch {
      alert('Payment setup failed. Please try again.');
    } finally {
      setSubscribing(null);
      setConfirmSwitch(null);
    }
  };

  const benefit = FEATURE_BENEFITS[reason];

  const calculateSavings = (monthlyPence: number, annualPence: number) => {
    if (monthlyPence === 0) return 0;
    const monthlyCost = monthlyPence * 12;
    return Math.round(((monthlyCost - annualPence) / monthlyCost) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin" />
          <p className="mt-4 text-slate-400">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <main className="max-w-5xl mx-auto px-6 py-20">
        {audience && (
          <Link
            href={audience === 'client' ? '/client/dashboard' : '/guard/dashboard'}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-8 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Dashboard
          </Link>
        )}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-lock-unlock-line" />
            {reason ? 'Upgrade Required' : 'Upgrade Your Plan'}
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            {isKnownFeature ? `Unlock ${featureName}` : reason ? 'Upgrade Your Plan' : 'Choose Your Plan'}
          </h1>

          {reason === 'guard_application_limit_reached' && (
            <div className="max-w-2xl mx-auto mb-6">
              <div className="bg-[#111d35] border border-orange-500/30 rounded-2xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/15 rounded-xl border border-orange-400/25 flex items-center justify-center flex-shrink-0">
                    <i className="ri-alert-line text-orange-400 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Monthly Application Limit Reached</h3>
                    <p className="text-slate-300">
                      You have reached your monthly application limit for your current plan. Upgrade your plan to apply for more jobs this month.
                    </p>
                  </div>
                </div>
                <div className="bg-[#0e1628] rounded-xl border border-slate-700/50 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Plan Application Limits</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Guard Starter</span>
                      <span className="text-slate-400">1 application per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Guard Basic</span>
                      <span className="text-slate-400">10 applications per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Guard Pro</span>
                      <span className="text-slate-400">25 applications per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Guard Elite</span>
                      <span className="text-teal-400 font-semibold">Unlimited applications</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reason === 'guard.plan_verification_failed' && (
            <div className="max-w-xl mx-auto mb-6">
              <div className="bg-[#111d35] border border-yellow-500/30 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-yellow-500/15 rounded-xl border border-yellow-400/25 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line text-yellow-400 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Plan Verification Failed</h3>
                    <p className="text-slate-300">
                      We could not verify your guard subscription plan. Please refresh or contact support.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reason === 'job_limit_reached' && (
            <div className="max-w-2xl mx-auto mb-6">
              <div className="bg-[#111d35] border border-orange-500/30 rounded-2xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/15 rounded-xl border border-orange-400/25 flex items-center justify-center flex-shrink-0">
                    <i className="ri-alert-line text-orange-400 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Monthly Job Posting Limit Reached</h3>
                    <p className="text-slate-300">
                      You have reached your monthly job posting limit for your current plan. Upgrade your plan to post more jobs this month.
                    </p>
                  </div>
                </div>
                <div className="bg-[#0e1628] rounded-xl border border-slate-700/50 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Plan Job Posting Limits</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Free Starter</span>
                      <span className="text-slate-400">1 job per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Client Starter</span>
                      <span className="text-slate-400">10 jobs per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Client Pro</span>
                      <span className="text-slate-400">30 jobs per month</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Client Enterprise</span>
                      <span className="text-teal-400 font-semibold">Unlimited jobs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isKnownFeature && reason !== 'guard_application_limit_reached' && reason !== 'guard.plan_verification_failed' && reason !== 'job_limit_reached' && (
            <div className="max-w-xl mx-auto">
              <p className="text-slate-300 text-lg mb-2">
                {featureName} is not included in your current plan.
              </p>
              <p className="text-slate-400">
                Upgrade to <span className="text-teal-400 font-semibold">{unlockMessage}</span> to unlock this feature.
              </p>
            </div>
          )}

          {reason && !isKnownFeature && (
            <p className="text-slate-400 max-w-xl mx-auto">
              This feature is not available on your current plan. Upgrade to a higher tier to unlock it.
            </p>
          )}

          {currentPlan && (
            <p className="text-slate-500 mt-4 text-sm">
              Currently on <span className="text-white font-semibold">{currentPlan.plan_name}</span>
            </p>
          )}

          {currentPlan && !currentPlan.is_free_tier && (
            <div className="max-w-xl mx-auto mt-4">
              <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-information-line text-amber-400 text-lg"></i>
                  </div>
                  <div>
                    <p className="text-amber-300 text-sm font-semibold mb-1">Plan Change Notice</p>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Switching plans will update your existing subscription immediately with prorated billing. You will only pay for the time you use on each plan — no double-billing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="inline-flex items-center bg-slate-800/80 backdrop-blur-sm rounded-full p-1 gap-1 border border-slate-700 mt-6">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                billingCycle === 'monthly'
                  ? 'bg-teal-500 text-slate-900 shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-teal-500 text-slate-900 shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Annual
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                Save
              </span>
            </button>
          </div>
        </div>

        {benefit && (
          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-8 mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl border border-teal-400/25 flex items-center justify-center">
                <i className="ri-rocket-2-line text-teal-400 text-2xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{benefit.title}</h2>
                <p className="text-sm text-slate-400">{benefit.desc}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {benefit.points.map((p) => (
                <div key={p.label} className="bg-[#0e1628] rounded-xl border border-[#1e2d4d] p-4">
                  <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center mb-3">
                    <i className={`${p.icon} text-teal-400 text-lg`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{p.label}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <i className="ri-checkbox-circle-fill text-teal-400" />
              <span>Available on <span className="text-teal-400 font-semibold">{unlockMessage}</span></span>
            </div>
          </div>
        )}

        {switchSuccess && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111d35] rounded-2xl border border-emerald-500/30 shadow-2xl max-w-md w-full p-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl border border-emerald-400/25 flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-3xl text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Plan Changed!</h3>
              <p className="text-slate-400 text-sm mb-4">
                Switched from <span className="text-slate-300 font-semibold">{switchSuccess.oldPlanName}</span> to{' '}
                <span className="text-emerald-400 font-semibold">{switchSuccess.newPlanName}</span>.
              </p>
              <p className="text-slate-500 text-xs mb-6">
                Prorated billing applied. No double charges. Returning to dashboard in {redirectCountdown}...
              </p>
              <button
                onClick={() => { window.location.href = audience === 'guard' ? '/guard/dashboard' : '/client/dashboard'; }}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer"
              >
                Go to Dashboard Now
              </button>
            </div>
          </div>
        )}

        {confirmSwitch && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-2xl max-w-lg w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl border border-amber-400/20 flex items-center justify-center">
                  <i className="ri-swap-line text-2xl text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Change Your Plan?</h3>
                  <p className="text-sm text-slate-400">You are switching from a paid subscription</p>
                </div>
              </div>

              <div className="bg-[#0e1628] rounded-xl border border-slate-700/50 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-500 mb-1">Current Plan</p>
                    <p className="text-sm font-bold text-slate-300">{confirmSwitch.currentPlanName}</p>
                  </div>
                  <div className="flex-shrink-0 px-3">
                    <i className="ri-arrow-right-line text-slate-500 text-lg" />
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-500 mb-1">New Plan</p>
                    <p className="text-sm font-bold text-teal-400">{confirmSwitch.plan.name}</p>
                  </div>
                </div>

                <div className="border-t border-slate-700/50 pt-3">
                  <div className="flex items-start gap-2.5">
                    <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 text-xs font-semibold mb-1">Prorated billing applies</p>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        You will only be charged for the time you used on {confirmSwitch.currentPlanName}, and the new {confirmSwitch.plan.name} rate applies going forward. No double-billing.
                      </p>
                    </div>
                  </div>
                </div>

                {confirmSwitch.plan.monthly_price_pence < (currentPlan?.monthly_price_pence || 0) && (
                  <div className="border-t border-slate-700/50 pt-3 mt-3">
                    <div className="flex items-start gap-2.5">
                      <i className="ri-alert-line text-orange-400 text-sm flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-orange-400 text-xs font-semibold mb-1">You are downgrading</p>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          Some features from {confirmSwitch.currentPlanName} may no longer be available on {confirmSwitch.plan.name}. Your existing data will be preserved.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {confirmSwitch.plan.monthly_price_pence > (currentPlan?.monthly_price_pence || 0) && (
                  <div className="border-t border-slate-700/50 pt-3 mt-3">
                    <div className="flex items-start gap-2.5">
                      <i className="ri-arrow-up-circle-line text-emerald-400 text-sm flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 text-xs font-semibold mb-1">Upgrading your plan</p>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          You will be charged the prorated difference for the remainder of this billing period. New features unlock immediately.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmSwitch(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 border border-slate-600 hover:bg-slate-700/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeSubscribe(confirmSwitch.plan)}
                  disabled={subscribing === confirmSwitch.plan.slug}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-500 text-white hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {subscribing === confirmSwitch.plan.slug ? 'Processing...' : 'Confirm Switch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center py-12">
            <i className="ri-error-warning-line text-5xl text-slate-600 mb-4 block" />
            <p className="text-slate-400">No plans available.</p>
            <Link href="/pricing" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
              View all pricing
            </Link>
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-8 ${plans.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : plans.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {plans.map((plan) => {
              const isSelected = recommendedPlan === plan.slug;
              const monthlyPrice = plan.monthly_price_pence / 100;
              const annualMonthlyEquiv = plan.stripe_annual_price_id
                ? Math.round((plan.monthly_price_pence * 10) / 100)
                : Math.round(plan.monthly_price_pence * 0.85 / 100);
              const price = billingCycle === 'monthly' ? monthlyPrice : annualMonthlyEquiv;
              const savings = plan.stripe_annual_price_id
                ? calculateSavings(plan.monthly_price_pence, plan.monthly_price_pence * 10)
                : 15;
              const accentColor = plan.audience === 'guard' ? 'blue' : 'teal';
              const isPopular = !!plan.badge || isSelected;
              const borderColor = accentColor === 'teal' ? 'border-teal-500' : 'border-blue-500';
              const textColor = accentColor === 'teal' ? 'text-teal-400' : 'text-blue-400';
              const bgColor = accentColor === 'teal' ? 'bg-teal-500' : 'bg-blue-500';
              const hoverBg = accentColor === 'teal' ? 'hover:bg-teal-400' : 'hover:bg-blue-400';
              const iconColor = accentColor === 'teal' ? 'text-teal-600' : 'text-blue-600';
              const iconBg = accentColor === 'teal' ? 'bg-teal-100' : 'bg-blue-100';

              return (
                <div
                  key={plan.slug}
                  className={`relative bg-[#111d35] rounded-2xl border flex flex-col transition-all hover:shadow-2xl ${
                    isPopular ? `${borderColor} shadow-xl ${plans.length === 3 ? 'scale-[1.03] z-10' : ''}` : 'border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className={`${bgColor} text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap`}>
                        {isSelected ? 'Recommended' : plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-8 flex-grow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
                        <i className={`${accentColor === 'teal' ? 'ri-building-line' : 'ri-shield-user-line'} text-xl ${iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      </div>
                    </div>
                    <p className="text-slate-400 mb-6 text-sm">{plan.description}</p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">£{price}</span>
                        <span className="text-slate-400">/month</span>
                      </div>
                      {billingCycle === 'annual' && plan.monthly_price_pence > 0 && (
                        <p className="text-sm text-emerald-400 font-semibold mt-1">
                          Save {savings}% with annual billing
                        </p>
                      )}
                      {billingCycle === 'annual' && plan.monthly_price_pence > 0 && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          Billed £{plan.stripe_annual_price_id ? plan.monthly_price_pence * 10 / 100 : Math.round(plan.monthly_price_pence * 0.85 / 100) * 12} annually
                        </p>
                      )}
                      {plan.monthly_price_pence === 0 && (
                        <p className="text-sm text-slate-500 mt-1">No credit card required</p>
                      )}
                      {plan.monthly_price_pence === 0 && (
                        <div className="mt-3 bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2.5">
                          <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300 leading-relaxed">
                            A service charge applies to all jobs on free accounts. Upgrade to a paid plan for lower fees.
                          </p>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2.5 text-sm">
                      {(plan.features || []).map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <i className={`ri-checkbox-circle-fill ${textColor} flex-shrink-0 mt-0.5`} />
                          <span className="text-slate-300">{getFeatureLabel(f, plan.audience)}</span>
                        </li>
                      ))}
                      {(plan.limitations || []).map((l: string, i: number) => (
                        <li key={`lim-${i}`} className="flex items-start gap-2.5 opacity-40">
                          <i className="ri-close-circle-line text-slate-500 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-400">{l}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-8 pt-0">
                    {plan.monthly_price_pence === 0 ? (
                      <Link
                        href={plan.audience === 'guard' ? '/guard/register' : '/client/register'}
                        className="w-full py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap block text-center bg-slate-700 text-white hover:bg-slate-600 border border-slate-600"
                      >
                        Get Started Free
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={subscribing === plan.slug}
                        className={`w-full py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap block text-center ${bgColor} text-white ${hoverBg} shadow-lg ${
                          subscribing === plan.slug ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                        }`}
                      >
                        {subscribing === plan.slug ? 'Processing...' : 'Subscribe'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/pricing" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            View all plans and pricing
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  );
}