import type {
  IndustryCard,
  IndustryCtaLink,
  IndustryExample,
  IndustryFaq,
  IndustryRole,
} from '@/components/industry/types';

export interface BookingStep {
  icon: string;
  title: string;
  desc: string;
}

export interface EventsContent {
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
  bookingTitle: string;
  bookingIntro: string;
  bookingSteps: BookingStep[];
  example: IndustryExample;
  complianceTitle: string;
  complianceParagraphs: string[];
  compliancePoints: string[];
  complianceNote: string;
  faqs: IndustryFaq[];
  relatedLinks: IndustryCtaLink[];
  ctaHeadline: string;
  ctaSub: string;
}

export const EVENTS_CONTENT: EventsContent = {
  slug: 'security-for-events',
  name: 'Private Events',
  eyebrow: 'Event security staffing',
  headline: 'Event security staffed around your event, not a fixed ratio.',
  subheadline:
    'Weddings, private parties, corporate functions and venue events. Check the guard availability that is recorded, then review and confirm a posting within your plan. What you need follows your own risk assessment, the venue, the duties and your licensing conditions.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20of%20image%20features%20a%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%20on%20the%20subject%2C%20simple%20uncluttered%20background&width=1600&height=900&seq=qg_events_hero_20260508&orientation=landscape',
  primaryCta: { label: 'Hire Event Security', href: '/client/register' },
  secondaryCta: { label: 'Browse Guards', href: '/find-a-guard' },
  problemsTitle: 'Private event pressures, and what settles them',
  problemsIntro:
    'Private events rarely stay still. These are the pressures QuickGuard helps you work through, without promising a set level of cover.',
  problems: [
    {
      icon: 'ri-user-follow-line',
      title: 'Guest numbers move',
      desc: 'A confirmed list can grow or shrink after the venue is booked, which changes what duties you need to arrange.',
    },
    {
      icon: 'ri-layout-grid-line',
      title: 'One event, several duties',
      desc: 'Arrival gate, bar area, dance floor and car park may each call for a different duty and a different skill.',
    },
    {
      icon: 'ri-file-shield-2-line',
      title: 'Stewarding and licensing differ',
      desc: 'Stewarding is not automatically licensable, while some security duties are. The activity decides, not the title.',
    },
    {
      icon: 'ri-user-settings-line',
      title: 'Recorded availability varies',
      desc: 'A guard\u2019s recorded licence, coverage area, travel radius and stated availability decide whether a shift can match at all.',
    },
    {
      icon: 'ri-building-4-line',
      title: 'Venue conditions apply',
      desc: 'The venue\u2019s own operating plan and any premises licence conditions can shape the duties you must arrange.',
    },
    {
      icon: 'ri-calendar-event-line',
      title: 'Dates shift late',
      desc: 'A date can move or a supplier can drop out close to the event, and matching guards may be few or none.',
    },
  ],
  solutionsTitle: 'How QuickGuard supports a private event requirement',
  solutionsIntro:
    'Check what is recorded, review who applies, and confirm only what the platform can actually support.',
  solutions: [
    {
      icon: 'ri-search-eye-line',
      title: 'Check recorded availability first',
      desc: 'Enter the venue postcode, shift date and times, licence level, venue type and the rate you intend to offer. It is a check of recorded details, not a reservation.',
    },
    {
      icon: 'ri-user-search-line',
      title: 'Review before you choose',
      desc: 'Compare event experience, ratings and the licence information each profile records before selecting anyone.',
    },
    {
      icon: 'ri-file-list-3-line',
      title: 'Post within your plan allowance',
      desc: 'Your client plan sets a monthly job posting allowance. The booking service fee is a separate charge from agreed guard pay.',
    },
    {
      icon: 'ri-secure-payment-line',
      title: 'Selection, then payment',
      desc: 'Selecting guards is provisional. The booking is confirmed only once the Stripe payment succeeds.',
    },
  ],
  rolesTitle: 'Duties a private event requirement may include',
  rolesIntro:
    'Role names describe the work, not the licence. Confirm which duties are licensable for your event before posting.',
  roles: [
    {
      icon: 'ri-door-open-line',
      name: 'Door Supervisors',
      desc: 'Arrival, guest list and access duties where door supervision is the licensable activity required.',
    },
    {
      icon: 'ri-shield-user-line',
      name: 'Security Guards',
      desc: 'Guarding duties such as posts, perimeters and site presence where that activity is licensable.',
    },
    {
      icon: 'ri-team-line',
      name: 'Stewards',
      desc: 'Stewarding, queue marshalling and guest-facing help, which are not automatically licensable.',
    },
    {
      icon: 'ri-vip-crown-line',
      name: 'VIP & Front-of-House',
      desc: 'Discreet guest support and VIP access duties, described as the activity rather than a guarantee of status.',
    },
    {
      icon: 'ri-user-star-line',
      name: 'Supervisors',
      desc: 'Coordinating a small security or stewarding team across the venue, alongside the duties they supervise.',
    },
    {
      icon: 'ri-camera-line',
      name: 'CCTV Operators',
      desc: 'Control room and surveillance duties where the venue has cameras. Licensing depends on the activity.',
    },
  ],
  bookingTitle: 'From availability check to confirmed booking',
  bookingIntro:
    'The guest availability check works the same way for a private event. Nothing is posted and no guard is notified until you sign in, review and confirm.',
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
      desc: 'Check the venue, shift dates and hours, the required licence level and the agreed gross guard rate, then publish within your allowance. Publishing the job does not take the booking payment.',
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
      desc: 'Before checkout you see the agreed gross guard pay, your plan\u2019s booking service fee and any eligible promotion. The fee is added on top of the agreed guard pay, never deducted from it, and no QuickGuard booking commission applies on new bookings.',
    },
  ],
  example: {
    title: 'What a private event requirement sets out',
    subtitle: 'A requirement describes duties and licence level. It does not fix headcount.',
    rows: [
      { label: 'Door supervision', value: 'Only where the duty is licensable' },
      { label: 'Security guarding', value: 'Only where the duty is licensable' },
      { label: 'Stewarding', value: 'Not automatically licensable' },
      { label: 'CCTV / control room', value: 'Depends on the activity performed' },
      { label: 'Supervision', value: 'Set by your event operating plan' },
    ],
    note: 'Staffing numbers depend on your risk assessment, the venue, expected attendance, layout and the duties actually performed. QuickGuard does not set a ratio or headcount for your event. Confirm the right duties and numbers with your own assessment and your licensing obligations.',
  },
  complianceTitle: 'Stewarding, licensable activity and event duties',
  complianceParagraphs: [
    'Event staffing numbers are not set by a fixed formula. What you need follows a risk assessment covering the venue, expected attendance, layout, timings, licensing conditions and the duties actually performed.',
    'Stewarding, queue marshalling, ticket checking and general guest-facing work are not automatically licensable. Door supervision, guarding and other security work are licensable where the activity falls within the SIA\u2019s scope. QuickGuard does not decide which category your duty belongs to.',
    'Check current SIA guidance and any venue or premises licence conditions before you write the requirement. If you are unsure whether a duty needs a licence, take advice from the SIA or your licensing contact.',
  ],
  compliancePoints: [
    'Your risk assessment sets the duties and the numbers',
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
      a: 'There is no fixed ratio. Numbers depend on your risk assessment, the venue, expected attendance, layout and the actual duties. QuickGuard does not set a headcount for your event. Confirm it with your assessment and your licensing obligations.',
    },
    {
      q: 'Do all event staff need an SIA licence?',
      a: 'No. Licensing depends on the activity, not the job title. Stewarding, queue marshalling and general guest service are not automatically licensable, while door supervision, guarding and other security work are licensable where the activity falls within SIA scope. Check current SIA guidance for your duties.',
    },
    {
      q: 'When is my event booking actually confirmed?',
      a: 'Selecting guards is provisional. The booking is confirmed only once the Stripe payment completes. Before that, the shift is not final and the guard is not committed.',
    },
    {
      q: 'What does a client pay for an event booking?',
      a: 'Your plan sets a monthly job posting allowance, and the booking service fee is a separate charge. The fee is calculated on the agreed gross guard pay, added on top of it, and shown with any eligible promotion before you confirm payment. Agreed guard pay is never reduced by it, and no guard booking commission applies on new bookings.',
    },
    {
      q: 'Do guards pay for event work or get priority?',
      a: 'No. Guard registration, browsing and applications are free. There is no paid guard membership, no paid job tier and no paid priority in discovery or applicant order, and applications are not capped by a paid plan. An approved account with a valid licence is still required where the duty is licensable.',
    },
    {
      q: 'Can cover be guaranteed for a specific event date?',
      a: 'No. A requirement can be posted whenever plans change, but cover depends on matching guards applying and on payment completing in time. No response time, number of applicants or confirmed guard is guaranteed.',
    },
    {
      q: 'Can I use the same guards for next year\u2019s event?',
      a: 'You can review and invite guards you have worked with again, subject to their recorded availability, licence and their own decision about the shift. Nothing about a previous booking reserves them for a future date.',
    },
  ],
  relatedLinks: [
    { label: 'Event security staffing overview', href: '/event-security' },
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your event requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
    { label: 'All industries', href: '/industries' },
  ],
  ctaHeadline: 'Ready to check your event requirement?',
  ctaSub:
    'Check recorded availability, then sign in to review and confirm the posting. Staffing levels stay with your own risk assessment, venue and licensing conditions.',
};