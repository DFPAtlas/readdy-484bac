export const GUIDE_STEP_SUMMARY = [
  { number: '01', icon: 'ri-user-add-line', title: 'Create Free Account' },
  { number: '02', icon: 'ri-shield-check-line', title: 'SIA Licence Review' },
  { number: '03', icon: 'ri-search-line', title: 'Browse & Apply' },
  { number: '04', icon: 'ri-money-pound-circle-line', title: 'Work & Get Paid' },
];

export const ACCOUNT_STEP_ITEMS = [
  'Select "I\'m a Guard" when you sign up',
  'Enter your email and create a password',
  'Verify your email using the confirmation link',
  'Add your profile and SIA licence details',
];

export const ACCOUNT_REQUIRED_INFO = [
  'Full name and contact details',
  'SIA licence number and expiry date',
  'Licence types (Door Supervisor, CCTV, etc.)',
  'Years of security experience',
  'Home postcode used for job distance',
];

export const SIA_FLOW = [
  { icon: 'ri-file-shield-line', label: 'Submit licence details', desc: 'Enter your SIA licence number and expiry date in your profile' },
  { icon: 'ri-search-eye-line', label: 'Details are reviewed', desc: 'Review can include a check against the SIA register' },
  { icon: 'ri-user-follow-line', label: 'Manual review may apply', desc: 'Some accounts need a manual check, which takes longer' },
  { icon: 'ri-mail-check-line', label: 'Approval email', desc: 'You are notified once your account is approved' },
  { icon: 'ri-verified-badge-line', label: 'Licence shown on profile', desc: 'Clients see your licence number and types' },
];

export const SIA_TIPS = [
  'Make sure your SIA licence is current and not expired',
  'Double-check the licence number before submitting',
  'Keep your profile details consistent with your licence',
  'Contact support if review is pending or more information is requested',
];

export const JOB_FACTORS = [
  { icon: 'ri-map-pin-line', title: 'Location', desc: 'Venue and distance where available' },
  { icon: 'ri-money-pound-circle-line', title: 'Pay Rate', desc: 'Hourly rate shown on the listing' },
  { icon: 'ri-calendar-line', title: 'Schedule', desc: 'Dates and working hours' },
  { icon: 'ri-shield-check-line', title: 'Requirements', desc: 'Licence types the job needs' },
];

export const PAYOUT_SETUP_TEXT =
  'Open Bank Settings in your guard account to set up your Stripe payout account, add your bank details and complete any verification Stripe requests.';

export const COMPLETION_TEXT =
  'Confirm the shift, check in at the start and check out at the end. Then submit the shift for completion so the client can review it.';

export const BANK_DEPOSIT_TEXT =
  'Release to your connected Stripe account and payment into your bank are separate stages. Stripe processes bank deposits according to your available balance, payout schedule and account requirements. A submitted transfer does not confirm a paid bank deposit.';

export const PAYOUT_SUPPORT_TEXT =
  'If the client has not confirmed completion, a transfer is delayed or Stripe asks for more information, check the job status, Bank Settings and Earnings. Contact QuickGuard support with the booking reference. QuickGuard does not promise a fixed payout time or bank arrival date.';

export const GUARD_PAYMENT_STEPS = [
  {
    icon: 'ri-bank-line',
    label: 'Set up your payout account',
    desc: PAYOUT_SETUP_TEXT,
  },
  {
    icon: 'ri-bank-card-line',
    label: 'Client pays by card',
    desc: 'The client pays by card through Stripe when the booking is confirmed. A shift is only confirmed once the client payment is funded.',
  },
  {
    icon: 'ri-shield-keyhole-line',
    label: 'Work the shift',
    desc: COMPLETION_TEXT,
  },
  {
    icon: 'ri-checkbox-circle-line',
    label: 'Completion is reviewed',
    desc: 'The client reviews your completion request and can approve it or raise a dispute. An open dispute or payment issue can pause release while it is reviewed.',
  },
  {
    icon: 'ri-secure-payment-line',
    label: 'Eligible pay is released to Stripe',
    desc: 'After completion approval and the applicable payment, dispute and Stripe account checks, eligible earnings are transferred to your connected Stripe account. This transfer is not the same as money arriving in your bank.',
  },
  {
    icon: 'ri-money-pound-circle-line',
    label: 'Stripe processes your bank deposit',
    desc: BANK_DEPOSIT_TEXT,
  },
];

export const BEST_PRACTICES = [
  { icon: 'ri-user-star-line', title: 'Keep Your Profile Updated', desc: 'Keep your availability, licence details and contact information current so clients see accurate information.' },
  { icon: 'ri-time-line', title: 'Arrive Before Your Shift', desc: 'Aim to arrive 10–15 minutes early so you can check in and receive the site briefing.' },
  { icon: 'ri-star-line', title: 'Work to Your Reviews', desc: 'Clients see your rating and reviews when they review applications, so professional conduct matters.' },
  { icon: 'ri-notification-3-line', title: 'Enable Job Alerts', desc: 'Turn on job-match emails to hear about jobs that fit your licence, rate and travel distance.' },
  { icon: 'ri-calendar-check-line', title: 'Honour Commitments', desc: 'Only apply for shifts you can definitely attend. Cancellations are visible in your record.' },
  { icon: 'ri-shield-star-line', title: 'Renew Your Licence', desc: 'Keep your SIA licence valid at all times. An expired licence means you cannot apply or work.' },
];

export const KEY_REMINDERS = [
  { icon: 'ri-shield-check-line', title: 'Keep Your SIA Licence Valid', desc: 'You cannot apply for or work jobs with an expired licence. Renew before the expiry date.' },
  { icon: 'ri-calendar-check-line', title: 'Honour Every Commitment', desc: 'Only apply for jobs you can definitely attend, and check in and out on site for the hours you work.' },
  { icon: 'ri-user-settings-line', title: 'Keep Your Profile Current', desc: 'Update your contact details, availability and licence information whenever anything changes.' },
  { icon: 'ri-mail-check-line', title: 'Check Emails Regularly', desc: 'Approval notices, job-match emails and payment updates are sent by email.' },
];

export const GUARD_GUIDE_FAQS = [
  {
    question: 'Is QuickGuard free for security guards?',
    answer:
      'Yes. Creating a guard account, browsing jobs and applying are free, with no monthly application cap and no paid job tiers. Account approval, a valid SIA licence and each job\'s own requirements still apply.',
  },
  {
    question: 'Do I need an SIA licence to apply?',
    answer:
      'Yes. You need a current SIA licence, and individual jobs can require specific licence types such as Door Supervisor or CCTV. Your account is reviewed before you can apply, and an expired licence blocks applications.',
  },
  {
    question: 'Does applying guarantee work or earnings?',
    answer:
      'No. Clients review applications and choose which guards to select, so a free application does not guarantee selection, hours or earnings. QuickGuard does not place you in a job.',
  },
  {
    question: 'Does QuickGuard take a cut of my agreed pay?',
    answer:
      'The agreed gross guard pay for a new booking is not reduced by a QuickGuard booking commission. Any QuickGuard service fee is charged to the client on top of the agreed guard pay. You are an independent contractor, so income tax and National Insurance are your responsibility and take-home pay is not guaranteed.',
  },
  {
    question: 'When will the money reach my bank?',
    answer:
      'After the client approves completion and the applicable payment, dispute and Stripe account checks, eligible earnings are transferred to your connected Stripe account. Stripe then pays into your bank on its own schedule based on your balance and account requirements. QuickGuard does not promise a fixed transfer time or bank arrival date.',
  },
  {
    question: 'Why do I need a Stripe payout account?',
    answer:
      'Guard pay is transferred through Stripe to the connected account you set up in Bank Settings. Stripe verifies your identity and bank details, and your account status affects whether transfers can be paid out. Without a ready Stripe account, eligible pay cannot be transferred to you.',
  },
  {
    question: 'I paid for a guard membership in the past. What happens now?',
    answer:
      'Paid guard memberships are no longer sold, and job access no longer depends on a membership. Existing membership and invoice records are retained in your account. If you hold an active legacy subscription you can manage or cancel it from the membership card in your guard dashboard, or contact billing support for a legacy membership or refund review.',
  },
  {
    question: 'What if my completion request is not approved?',
    answer:
      'Open the job to see its current status and any dispute raised by the client. Payment release can be paused while a dispute or payment issue is reviewed. Contact support with the booking reference if you need help.',
  },
];