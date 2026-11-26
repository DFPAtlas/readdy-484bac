import type { IndustryCard, IndustryCtaLink, IndustryExample, IndustryFaq, IndustryRole } from '@/components/industry/types';

export interface EventBookingStep {
  icon: string;
  title: string;
  desc: string;
}

export interface EventCoverTier {
  key: 'planned' | 'shortNotice' | 'onTheDay';
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  items: string[];
}

export interface EventContent {
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  primaryCta: IndustryCtaLink;
  secondaryCta: IndustryCtaLink;
  problemsTitle: string;
  problemsIntro: string;
  problems: IndustryCard[];
  solutionsTitle: string;
  solutionsIntro: string;
  solutions: IndustryCard[];
  rolesTitle: string;
  rolesIntro: string;
  roles: IndustryRole[];
  coverTitle: string;
  coverIntro: string;
  coverTiers: EventCoverTier[];
  example: IndustryExample;
  featureMessage: string;
  featureSub: string;
  featureImage: string;
  bookingTitle: string;
  bookingIntro: string;
  bookingSteps: EventBookingStep[];
  complianceParagraphs: string[];
  compliancePoints: string[];
  complianceNote: string;
  faqs: IndustryFaq[];
  relatedLinks: IndustryCtaLink[];
}

export const EVENT_CONTENT: EventContent = {
  slug: 'event-security',
  name: 'Events & Festivals',
  eyebrow: 'Event security staffing',
  headline: 'Staff your event around the duties it actually needs.',
  subheadline:
    'Compare security and stewarding profiles for concerts, festivals, exhibitions, sporting events and private functions. Staffing levels follow your own risk assessment, the venue, the event and the duties involved.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_events_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Check Event Availability', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'Event staffing pressures, and what actually settles them',
  problemsIntro:
    'Events change quickly. These are the pressures QuickGuard helps you work through, without promising a fixed level of cover.',
  problems: [
    {
      icon: 'ri-layout-grid-line',
      title: 'Duties vary across one site',
      desc: 'Gates, arena, perimeter and control room may each call for a different duty, and the mix depends on your plan.',
    },
    {
      icon: 'ri-file-shield-2-line',
      title: 'Numbers follow a risk assessment',
      desc: 'Staffing levels come from your risk assessment, venue capacity, layout and duties, not from a fixed ratio.',
    },
    {
      icon: 'ri-refresh-line',
      title: 'The plan can change',
      desc: 'Changes to capacity, running order or site layout can change what duties you need to cover.',
    },
    {
      icon: 'ri-user-settings-line',
      title: 'Different duties need different licences',
      desc: 'Where an activity is licensable, the licence has to match the duty rather than just the job title.',
    },
    {
      icon: 'ri-user-unfollow-line',
      title: 'Availability differs by date',
      desc: 'A guard\u2019s recorded availability, travel area and licence decide whether a shift can be filled at all.',
    },
    {
      icon: 'ri-calendar-event-line',
      title: 'Event dates move',
      desc: 'Requirements can appear close to the date, and the number of matching guards may be small or zero.',
    },
  ],
  solutionsTitle: 'How QuickGuard supports an event requirement',
  solutionsIntro:
    'Check what is recorded, review who applies, and confirm only what the platform can actually support.',
  solutions: [
    {
      icon: 'ri-search-eye-line',
      title: 'Check recorded availability first',
      desc: 'Enter postcode, shift details, licence level and rate to see how many guards\u2019 recorded details match. It is a check, not a reservation.',
    },
    {
      icon: 'ri-user-search-line',
      title: 'Review before you choose',
      desc: 'Compare experience, ratings and the licence information shown on each profile before selecting anyone.',
    },
    {
      icon: 'ri-file-list-3-line',
      title: 'Post within your plan allowance',
      desc: 'Your client plan sets a monthly job posting allowance. The booking service fee is separate from agreed guard pay.',
    },
    {
      icon: 'ri-secure-payment-line',
      title: 'Selection, then payment',
      desc: 'Selecting guards is provisional. The booking is confirmed only once the Stripe payment succeeds.',
    },
  ],
  rolesTitle: 'Duties an event requirement may include',
  rolesIntro:
    'Role names describe the work, not the licence. Confirm which duties are licensable for your event before posting.',
  roles: [
    {
      icon: 'ri-door-open-line',
      name: 'Door Supervisors',
      desc: 'Entry, access and front-of-house duties where door supervision is the licensable activity required.',
    },
    {
      icon: 'ri-shield-user-line',
      name: 'Security Guards',
      desc: 'Guarding duties such as posts, perimeters and site presence where that activity is licensable.',
    },
    {
      icon: 'ri-team-line',
      name: 'Stewards',
      desc: 'Stewarding, queue marshalling and customer-facing duties, which are not automatically licensable.',
    },
    {
      icon: 'ri-camera-line',
      name: 'CCTV Operators',
      desc: 'Control room and surveillance duties. Whether a licence applies depends on the activity performed.',
    },
    {
      icon: 'ri-user-star-line',
      name: 'Supervisors',
      desc: 'Coordinating a security or stewarding team across a site, alongside the duties they supervise.',
    },
  ],
  coverTitle: 'Planned, short-notice and on-the-day requirements',
  coverIntro:
    'You can post whenever the requirement appears. Timing affects how likely a match is; it does not create a guarantee of cover.',
  coverTiers: [
    {
      key: 'planned',
      label: 'Planned requirement',
      icon: 'ri-calendar-schedule-line',
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
      border: 'border-teal-400/20',
      items: [
        'Posting an event requirement well ahead of the date',
        'Setting out duties per role for gates, arena and control room',
        'Reviewing applications and confirming within your plan allowance',
      ],
    },
    {
      key: 'shortNotice',
      label: 'Short-notice requirement',
      icon: 'ri-timer-flash-line',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      items: [
        'Posting when plans change close to the event date',
        'Replacing an operative who withdraws before the event',
        'Filling a duty that appears after the final site walk',
      ],
    },
    {
      key: 'onTheDay',
      label: 'On-the-day realities',
      icon: 'ri-information-line',
      color: 'text-slate-300',
      bg: 'bg-slate-500/10',
      border: 'border-slate-400/20',
      items: [
        'A short-notice post may receive no matching applications',
        'Cover is confirmed only after selection and a successful payment',
        'No response time or number of applicants is guaranteed',
      ],
    },
  ],
  example: {
    title: 'What an event requirement sets out',
    subtitle: 'A requirement describes duties and licence level. It does not fix headcount.',
    rows: [
      { label: 'Door supervision', value: 'Only where the duty is licensable' },
      { label: 'Security guarding', value: 'Only where the duty is licensable' },
      { label: 'Stewarding', value: 'Not automatically licensable' },
      { label: 'CCTV / control room', value: 'Depends on the activity performed' },
      { label: 'Supervision', value: 'Set by your operating plan' },
    ],
    note: 'Staffing numbers depend on the risk assessment, venue, event and actual duties. QuickGuard does not set a ratio or headcount for your event. Confirm the right duties and numbers with your own assessment and licensing obligations.',
  },
  featureMessage: 'One event. Several duties. Reviewed in one place.',
  featureSub:
    'Compare door supervision, guarding, stewarding and supervisory profiles against the duties your event actually needs.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Large%20team%20of%20licensed%20event%20security%20staff%20in%20black%20uniforms%20spread%20across%20a%20busy%20UK%20festival%20arena%20managing%20crowds%20near%20a%20main%20stage%20with%20dramatic%20lighting%2C%20organised%20and%20professional%20atmosphere%2C%20deep%20blue%20and%20teal%20tones%20with%20warm%20stage%20glow%2C%20cinematic%20documentary%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_events_feature_20261001&orientation=landscape',
  bookingTitle: 'From availability check to confirmed booking',
  bookingIntro:
    'The guest availability check is the same for event requirements. Nothing is posted and no guard is notified until you sign in, review and confirm.',
  bookingSteps: [
    {
      icon: 'ri-search-eye-line',
      title: 'Check recorded availability as a guest',
      desc: 'Enter the venue postcode, shift date and times, required licence level, venue type and the rate you intend to offer. The check counts guards whose recorded coverage area, travel radius and stated availability fit. It is not a reservation, holds no guard and does not guarantee cover.',
    },
    {
      icon: 'ri-login-box-line',
      title: 'Sign in or register a client account',
      desc: 'The guest check posts nothing and notifies nobody. Sign in or create a client account to continue. Your plan sets the monthly posting allowance and the booking service fee that applies.',
    },
    {
      icon: 'ri-file-list-3-line',
      title: 'Review and confirm the posting',
      desc: 'Check the location, shift dates and hours, the required licence level and the agreed gross guard rate, then publish within your allowance. Publishing the job does not take the booking payment.',
    },
    {
      icon: 'ri-user-add-line',
      title: 'Guards whose details match can apply',
      desc: 'Matching guards can apply. Guard registration, browsing and applications are free, applications are not capped by a paid plan, and no paid tier reorders applicants or gives paid priority.',
    },
    {
      icon: 'ri-checkbox-circle-line',
      title: 'Selection is provisional',
      desc: 'Review the applications and choose who you want for the shift. Until payment completes, the shift is not confirmed and the guard is not committed to it.',
    },
    {
      icon: 'ri-secure-payment-line',
      title: 'Stripe payment confirms the booking',
      desc: 'Before checkout you see the agreed gross guard pay, your plan\u2019s booking service fee and any eligible promotion. The fee is added on top of the agreed guard pay, never deducted from it, and no guard booking commission applies on new bookings.',
    },
  ],
  complianceParagraphs: [
    'Event staffing levels are not set by a fixed ratio. What you need follows a risk assessment covering the venue, the event, expected attendance, site layout, licensing conditions and the duties actually performed.',
    'Stewarding, queue marshalling, ticket scanning and general customer-facing work are not automatically licensable. Door supervision, guarding and other security work are licensable where the activity falls within the SIA\u2019s scope. QuickGuard does not decide which category your duty belongs to.',
    'Check current SIA guidance and your venue\u2019s or premises licence conditions before you write the requirement. If you are unsure whether a duty needs a licence, take advice from the SIA or your licensing contact.',
  ],
  compliancePoints: [
    'Risk assessment sets the duties and the numbers',
    'Stewarding is not automatically a licensable role',
    'Licence wording has to match the duty, not the title',
    'Venue and premises licence conditions still apply',
  ],
  complianceNote:
    'Where a duty involves licensable security activity, profiles show the licence information the guard has recorded. Review it against the duty before selecting anyone. A recorded licence is not confirmation that a specific duty is licensed, that anything has been verified beyond what is shown, or that cover will be filled.',
  faqs: [
    {
      q: 'Does checking availability reserve guards for my event?',
      a: 'No. The guest check counts guards whose recorded licence, coverage area, travel radius and stated availability fit the details you entered. It is not a reservation, it holds no guard and it does not guarantee cover. Guards still decide whether to apply.',
    },
    {
      q: 'What happens after I check availability?',
      a: 'A check posts nothing and notifies no guard. To continue you sign in or register a client account, review the requirement within your plan\u2019s monthly posting allowance and confirm the posting. No card details are taken at that point.',
    },
    {
      q: 'How many stewards or guards does my event need?',
      a: 'There is no fixed ratio. Numbers depend on your risk assessment, the venue, the event, expected attendance, layout and the actual duties. QuickGuard does not set a headcount for your event. Confirm it with your assessment and your licensing obligations.',
    },
    {
      q: 'Do all event staff need an SIA licence?',
      a: 'No. Licensing depends on the activity, not the job title. Stewarding, queue marshalling, ticket scanning and general customer service are not automatically licensable, while door supervision, guarding and other security work are licensable where the activity falls within SIA scope. Check current SIA guidance for your duties.',
    },
    {
      q: 'When is my event booking actually confirmed?',
      a: 'Selecting guards is provisional. The booking is confirmed only once the Stripe payment completes. Before that, the shift is not final and the guard is not committed.',
    },
    {
      q: 'What does a client pay for an event booking?',
      a: 'Your plan sets a monthly job posting allowance, and the booking service fee is a separate charge. The fee is calculated on the agreed gross guard pay, added on top of it, and shown with any eligible promotion before you confirm payment. Agreed guard pay is never reduced by it.',
    },
    {
      q: 'Do guards pay for event work or get priority?',
      a: 'No. Guard registration, browsing and applications are free. There is no paid guard membership, no paid job tier and no paid priority in discovery or applicant order, and applications are not capped by a paid plan. An approved account with a valid licence is still required where the duty is licensable.',
    },
    {
      q: 'Can cover be guaranteed for a specific event date?',
      a: 'No. Short-notice requirements can be posted, but cover depends on matching guards applying and on payment completing in time. No response time, number of applicants or confirmed guard is guaranteed.',
    },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your event requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};