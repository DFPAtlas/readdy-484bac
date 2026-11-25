import { CANCELLATION_GUIDANCE, GUARD_CANCELLATION_GUIDANCE, REFUND_TIMING_GUIDANCE } from '@/lib/customer-guidance';
import { GUARD_COMPLETION_GUIDANCE } from '@/lib/guard-payment-guidance';
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

export const CANCELLATION_WINDOWS: CancellationWindow[] = [
  { label: "Before payment", outcome: "No booking payment to refund", detail: "Posting a job does not capture the booking payment.", tone: "good" },
  { label: "After payment", outcome: "Refund review", detail: "The team reviews the original payment, timing, booking circumstances and any service fee.", tone: "warn" },
  { label: "After payout starts", outcome: "Contact support", detail: "A payment or payout already started can block cancellation. Contact support for review.", tone: "warn" },
];

export const CANCELLATION_NOTES = [CANCELLATION_GUIDANCE, `${GUARD_CANCELLATION_GUIDANCE} ${REFUND_TIMING_GUIDANCE}`];

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
  { title: "Pay is released", desc: "After completion approval and payment checks, eligible pay is released to the guard's Stripe account. Stripe processes the bank deposit separately." },
];

export const GUARD_JOURNEY: JourneyStep[] = [
  { title: "Create your profile", desc: "Register free and upload your SIA licence." },
  { title: "Licence checked", desc: "You can take work once your SIA licence check is passed." },
  { title: "Set your radius", desc: "Get alerts for jobs within the distance you're willing to travel." },
  { title: "Apply for shifts", desc: "Apply to the jobs that suit you. Clients choose who to book." },
  { title: "Request completion", desc: GUARD_COMPLETION_GUIDANCE },
  { title: "Track your pay", desc: "Complete Stripe setup in Bank Settings. Eligible pay is released to Stripe after approval and checks; Stripe then processes your bank deposit. See the payout guide below." },
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
  { title: "Getting started", desc: "Register free and build your profile.", href: "/guide/guard" },
  { title: "SIA verification", desc: "Uploading your licence and what to do if it's delayed.", href: "/guide/guard" },
  { title: "Finding work", desc: "Job alerts, travel radius and applying.", href: "/guide/guard" },
  { title: "Getting paid", desc: "Stripe payout setup and when pay is released.", href: "/guide/guard" },
  { title: "On the shift", desc: "Check-in, completion and reporting problems.", href: "/guide/guard" },
  { title: "Membership", desc: "Free job access, existing billing records and support.", href: "/guide/guard" },
];
