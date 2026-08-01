export interface OnboardingItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  href: string;
  priority: number;
}

export interface OnboardingResult {
  items: OnboardingItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  nextAction: { label: string; href: string } | null;
  trialDaysLeft: number | null;
  isTrialActive: boolean;
}

export function getDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  const days = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days;
}

export function computeOnboarding(
  clientData: {
    company_name?: string;
    phone?: string;
    address_line1?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    billing_email?: string | null;
    vat_number?: string | null;
    billing_address_line1?: string | null;
    stripe_customer_id?: string | null;
    onboarding_status?: string;
    trial_end_date?: string | null;
  },
  contacts: any[],
  prefs: any,
  jobsCount: number,
  subscriptionData: { trial_end_date?: string | null; status?: string } | null
): OnboardingResult {
  const isProfileComplete = !!(
    clientData.company_name &&
    clientData.phone &&
    clientData.address_line1 &&
    clientData.first_name &&
    clientData.last_name
  );
  const isBillingComplete = !!(
    clientData.billing_email ||
    clientData.vat_number ||
    clientData.billing_address_line1 ||
    clientData.stripe_customer_id
  );
  const hasSiteContact = contacts.length > 0;
  const hasNotifications = !!prefs;
  const hasPostedJob = jobsCount > 0;
  const hasSeenApplicantFlow = !!clientData.onboarding_status &&
    clientData.onboarding_status.includes("applicant_flow_viewed");

  const items: OnboardingItem[] = [
    {
      id: "profile",
      label: "Complete Company Profile",
      description: "Add your company name, address, and contact details",
      icon: "ri-building-line",
      completed: isProfileComplete,
      href: "/client/profile",
      priority: 1,
    },
    {
      id: "billing",
      label: "Add Billing Details",
      description: "Add VAT, billing address, or confirm your trial",
      icon: "ri-bank-card-line",
      completed: isBillingComplete,
      href: "/client/profile?tab=billing",
      priority: 2,
    },
    {
      id: "site-contact",
      label: "Add Site Contact",
      description: "Add a primary contact for your security sites",
      icon: "ri-contacts-line",
      completed: hasSiteContact,
      href: "/client/profile?tab=contacts",
      priority: 3,
    },
    {
      id: "notifications",
      label: "Set Notification Preferences",
      description: "Choose how you want to be alerted about jobs and applicants",
      icon: "ri-notification-3-line",
      completed: hasNotifications,
      href: "/client/profile?tab=preferences",
      priority: 4,
    },
    {
      id: "first-job",
      label: "Post Your First Job",
      description: "Create a security job posting and get matched with guards",
      icon: "ri-briefcase-line",
      completed: hasPostedJob,
      href: "/client/post-job",
      priority: 5,
    },
    {
      id: "applicant-flow",
      label: "Learn the Applicant Flow",
      description: "Understand how guard selection and booking works",
      icon: "ri-book-read-line",
      completed: hasSeenApplicantFlow,
      href: "/guide/client",
      priority: 6,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  const next = items
    .filter((i) => !i.completed)
    .sort((a, b) => a.priority - b.priority)[0];

  const nextAct = next
    ? {
        label: next.label,
        href: next.href,
      }
    : null;

  const trialEnd =
    subscriptionData?.trial_end_date || clientData.trial_end_date;
  const tDays = getDaysUntil(trialEnd);
  const isTrial =
    subscriptionData?.status === "trialing" ||
    (!!clientData.trial_end_date &&
      new Date(clientData.trial_end_date) > new Date());

  return {
    items,
    progress,
    completedCount,
    totalCount: items.length,
    nextAction: nextAct,
    trialDaysLeft: tDays,
    isTrialActive: isTrial,
  };
}