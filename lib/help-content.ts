export type ClientPlan = {
  slug: string;
  name: string;
  serviceFeePct: number;
  postingAllowance: string;
};

export type GuardMembership = {
  name: string;
  monthlyPrice: number;
};

export type CancellationWindow = {
  label: string;
  outcome: string;
  detail: string;
  tone: "good" | "warn" | "bad";
};

export type LicenceCheck = {
  status: "live" | "coming";
  title: string;
  detail: string;
};

export type JourneyStep = {
  title: string;
  desc: string;
};

export type HelpTopic = {
  title: string;
  desc: string;
  href: string;
};

export const CLIENT_PLANS: ClientPlan[] = [
  { slug: "free", name: "Free", serviceFeePct: 15, postingAllowance: "1 job posting per month" },
  { slug: "starter", name: "Starter", serviceFeePct: 10, postingAllowance: "10 job postings per month" },
  { slug: "pro", name: "Pro", serviceFeePct: 7.5, postingAllowance: "30 job postings per month" },
  { slug: "enterprise", name: "Enterprise", serviceFeePct: 5, postingAllowance: "Unlimited job postings" },
];

export const GUARD_MEMBERSHIPS: GuardMembership[] = [
  { name: "Basic", monthlyPrice: 10 },
  { name: "Pro", monthlyPrice: 19 },
  { name: "Elite", monthlyPrice: 29 },
];

export const CANCELLATION_WINDOWS: CancellationWindow[] = [
  { label: "More than 24 hours before", outcome: "Full refund", detail: "Including the service fee.", tone: "good" },
  { label: "12 to 24 hours before", outcome: "50% of guard fee", detail: "The service fee is retained.", tone: "warn" },
  { label: "Less than 12 hours before", outcome: "No refund", detail: "The guard has kept the shift free for you.", tone: "bad" },
];

export const CANCELLATION_NOTES: string[] = [
  "If a guard cancels, you get a full refund including the service fee.",
  "Cancel from My Jobs until the guard's payout has started. Our team reviews every refund request.",
];

export const LICENCE_CHECKS: LicenceCheck[] = [
  {
    status: "live",
    title: "SIA licence check before any work",
    detail: "Every guard must pass an SIA licence check before they can take work through QuickGuard.",
  },
  {
    status: "coming",
    title: "Automated weekly re-checks",
    detail: "We're developing weekly re-checks that will flag suspended, revoked or expired licences for review.",
  },
];

export const CLIENT_JOURNEY: JourneyStep[] = [
  { title: "Choose a plan", desc: "Your plan sets your monthly posting allowance and booking service fee." },
  { title: "Post your job", desc: "Describe the shift in minutes. Posting doesn't charge you." },
  { title: "Local guards are notified", desc: "Verified guards whose travel radius covers your location see it." },
  { title: "Pick your guard", desc: "Compare applicants and check their SIA credentials." },
  { title: "Pay securely", desc: "Review the total and pay through Stripe to confirm the booking." },
  { title: "Pay is released", desc: "Funds are held with Stripe and released after the shift is complete." },
];

export const GUARD_JOURNEY: JourneyStep[] = [
  { title: "Create your profile", desc: "Register, choose a membership and upload your SIA licence." },
  { title: "Licence checked", desc: "You can take work once your SIA licence check is passed." },
  { title: "Set your radius", desc: "Get alerts for jobs within the distance you're willing to travel." },
  { title: "Apply for shifts", desc: "Apply to the jobs that suit you. Clients choose who to book." },
  { title: "Work the shift", desc: "Full job details, venue and hours are in your dashboard." },
  { title: "Get paid in full", desc: "Once the client confirms completion, your pay is released." },
];

export const CLIENT_TOPICS: HelpTopic[] = [
  { title: "Getting started", desc: "Set up your account and post your first job.", href: "/guide/client" },
  { title: "Plans & fees", desc: "Posting allowances, service fees and promotions.", href: "/guide/client" },
  { title: "Choosing a guard", desc: "Reading profiles, SIA credentials and reviews.", href: "/guide/client" },
  { title: "Payments & refunds", desc: "How payment is held, released and refunded.", href: "/guide/client" },
  { title: "Cancellations & disputes", desc: "Cancelling, no-shows and raising a complaint.", href: "/guide/client" },
  { title: "Account & billing", desc: "Invoices, subscription changes and your profile.", href: "/guide/client" },
];

export const GUARD_TOPICS: HelpTopic[] = [
  { title: "Getting started", desc: "Register, choose a membership and build your profile.", href: "/guide/guard" },
  { title: "SIA verification", desc: "Uploading your licence and what to do if it's delayed.", href: "/guide/guard" },
  { title: "Finding work", desc: "Job alerts, travel radius and applying.", href: "/guide/guard" },
  { title: "Getting paid", desc: "Stripe payout setup and when pay is released.", href: "/guide/guard" },
  { title: "On the shift", desc: "Check-in, completion and reporting problems.", href: "/guide/guard" },
  { title: "Membership", desc: "Basic, Pro and Elite, upgrades and cancelling.", href: "/guide/guard" },
];