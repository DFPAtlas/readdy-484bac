export interface IndustryLink {
  name: string;
  href: string;
  icon: string;
  badge: string;
  desc: string;
  licenceNote: string;
}

export const INDUSTRIES: IndustryLink[] = [
  {
    name: 'Security Companies',
    href: '/security-companies',
    icon: 'ri-shield-star-line',
    badge: 'Manpower support',
    desc: 'Backfill a shift or add officers when your own workforce cannot cover a contract, without adding permanent headcount.',
    licenceNote: 'Door supervision, security guarding, CCTV and close protection each need the matching SIA licence for that duty.',
  },
  {
    name: 'Pubs, Bars & Nightclubs',
    href: '/pubs-bars-nightclubs',
    icon: 'ri-goblet-line',
    badge: 'Door supervision',
    desc: 'Find door supervisors for weekend trade, scheduled events and gaps that appear close to opening.',
    licenceNote: 'Door supervision at licensed premises requires an SIA Door Supervisor licence. Bar and cloakroom staff are not licensable roles.',
  },
  {
    name: 'Events & Festivals',
    href: '/event-security',
    icon: 'ri-calendar-event-line',
    badge: 'Multi-role teams',
    desc: 'Source door supervisors, security guards and CCTV operators across gates, perimeters and control rooms.',
    licenceNote: 'Only licensable duties need a licence. Stewarding, ticket scanning and queue marshalling are not automatically licensable.',
  },
  {
    name: 'Construction',
    href: '/construction-security',
    icon: 'ri-hammer-line',
    badge: 'Site security',
    desc: 'Cover sites, plant and materials with manned guarding where the duty is licensable security work.',
    licenceNote: 'Manned guarding and access control need an SIA Security Guarding licence; gate marshalling and traffic duties usually do not.',
  },
  {
    name: 'Hotels & Hospitality',
    href: '/hotel-security',
    icon: 'ri-hotel-line',
    badge: 'Hospitality cover',
    desc: 'Add security for weddings, conferences, functions and busy trading periods, booked shift by shift.',
    licenceNote: 'Concierge and guest service roles are not licensable in themselves; guarding and door supervision activity is.',
  },
  {
    name: 'Retail',
    href: '/retail-security',
    icon: 'ri-store-2-line',
    badge: 'Retail cover',
    desc: 'Cover peak trading, seasonal demand and unexpected shortages with guarding where the role is licensable.',
    licenceNote: 'Security guarding duties need an SIA Security Guarding licence; general shop-floor customer service does not.',
  },
];

export interface BookingStep {
  icon: string;
  title: string;
  desc: string;
}

export const BOOKING_STEPS: BookingStep[] = [
  {
    icon: 'ri-search-eye-line',
    title: 'Check availability as a guest',
    desc: 'Enter the venue postcode, shift date and times, required licence level, venue type and the rate you intend to offer. The check counts guards whose recorded coverage area, travel radius and stated availability fit those criteria.',
  },
  {
    icon: 'ri-login-box-line',
    title: 'Sign in or register a client account',
    desc: 'The guest check does not create a booking. Sign in or create a client account to continue. Your plan sets the monthly posting allowance and the standard booking service fee that applies.',
  },
  {
    icon: 'ri-file-list-3-line',
    title: 'Review and confirm the posting',
    desc: 'Check the location, shift dates and hours, the required SIA licence level and the agreed gross guard rate, then publish within your allowance. Publishing the job does not take the booking payment.',
  },
  {
    icon: 'ri-user-add-line',
    title: 'Eligible guards apply',
    desc: 'Guards whose recorded licence, coverage and availability fit the job are notified and can apply. Guard registration, browsing and applications are free, and no paid tier reorders applicants.',
  },
  {
    icon: 'ri-checkbox-circle-line',
    title: 'Selection is provisional',
    desc: 'Review the applications and select who you want for the shift. Until the payment completes, the shift is not confirmed and the guard is not committed to it.',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'Stripe payment confirms the booking',
    desc: 'Before checkout you see the agreed gross guard pay, your plan\u2019s booking service fee and any eligible promotion. The fee is added on top of the agreed guard pay, never deducted from it.',
  },
];

export const GUARD_FACTS: string[] = [
  'Register, browse jobs and apply without paying a membership fee',
  'No paid job tiers and no paid priority in job discovery or applicant order',
  'Applications are not capped by a paid plan',
  'Agreed gross pay is not reduced by a platform booking commission on new bookings',
  'Account approval and a valid SIA licence still apply where the role is licensable',
];

export const CLIENT_FACTS: string[] = [
  'Your plan sets a monthly job posting allowance',
  'Subscription and booking payments are separate charges',
  'The booking service fee is charged on top of agreed gross guard pay, never deducted from it',
  'The fee and any eligible promotion are shown before you confirm payment',
  'The booking is confirmed only after the Stripe payment succeeds',
];

export interface LicenceRole {
  role: string;
  licence: string;
  note: string;
}

export const LICENCE_ROLES: LicenceRole[] = [
  {
    role: 'Door supervision',
    licence: 'SIA Door Supervisor licence',
    note: 'Venue doors, access control and queue management where door supervision is a licensable activity.',
  },
  {
    role: 'Security guarding',
    licence: 'SIA Security Guarding licence',
    note: 'Manned guarding, patrolling and site access control where the duty is licensable.',
  },
  {
    role: 'Public space surveillance',
    licence: 'SIA CCTV (PSS) licence',
    note: 'CCTV monitoring that counts as public space surveillance. General site cameras may not need a PSS licence.',
  },
  {
    role: 'Close protection',
    licence: 'SIA Close Protection licence',
    note: 'Close protection duties carried out for a principal.',
  },
  {
    role: 'Guarding with a dog',
    licence: 'SIA Dog Handler licence',
    note: 'Where the role is guarding with a dog rather than general site presence.',
  },
];

export const NON_LICENSABLE_ROLES: string[] = [
  'Stewarding, queue marshalling and ticket scanning',
  'Cloakroom, guest services and reception duties',
  'General customer service and shop-floor assistance',
  'Roles that fall within the SIA in-house exemption, subject to its conditions',
];

export interface IndustriesFaq {
  category: string;
  question: string;
  answer: string;
}

export const FAQS: IndustriesFaq[] = [
  {
    category: 'Availability',
    question: 'Can I check availability before creating an account?',
    answer:
      'Yes. A guest can enter a venue postcode, shift date and times, licence level, venue type and rate. The check counts guards whose recorded coverage area, travel radius and stated availability match those details.',
  },
  {
    category: 'Availability',
    question: 'Does an availability match reserve a guard?',
    answer:
      'No. A match is an indication based on what guards have recorded. It is not a reservation, it does not hold a guard, and it is not a guarantee of cover. The shift depends on eligible guards choosing to apply and on the booking payment completing.',
  },
  {
    category: 'Guards',
    question: 'Do guards pay to register, browse or apply?',
    answer:
      'No. Guard registration, job browsing and applications are free. There is no paid guard membership, no paid job tier and no paid priority in discovery or applicant order, and applications are not capped by a paid plan. An approved account with a valid SIA licence is still required where the role is licensable.',
  },
  {
    category: 'Clients',
    question: 'What does a client pay?',
    answer:
      'Your plan sets a monthly job posting allowance, and the booking service fee is a separate charge applied per booking. The fee is calculated on the agreed gross guard pay, added on top of it, and shown with any eligible promotion before you confirm payment. Publishing a job does not take the booking payment.',
  },
  {
    category: 'Payment',
    question: 'When is a booking actually confirmed?',
    answer:
      'Selecting guards is provisional. The booking is confirmed only once the Stripe payment completes. Before then the shift is not final and the guard is not committed.',
  },
  {
    category: 'Payment',
    question: 'What does the guard receive?',
    answer:
      'The agreed gross hourly rate multiplied by the booked hours. On new bookings that amount is not reduced by a platform or booking commission. Payment is released after shift completion approval and the applicable payment, dispute and Stripe account checks, with the bank payout a separate later step.',
  },
  {
    category: 'Licences',
    question: 'Do all security roles need an SIA licence?',
    answer:
      'No. Licensing depends on the activity, not on the industry. Door supervision, security guarding, public space surveillance CCTV and close protection are licensable when carried out as those activities. Stewarding, ticket scanning, cloakroom and general guest service roles are not automatically licensable.',
  },
  {
    category: 'Cover',
    question: 'Can QuickGuard guarantee cover for a specific date?',
    answer:
      'No. Short-notice requirements can be posted, but cover depends on eligible guards applying and on payment completing in time. No response time, number of applicants or confirmed guard is guaranteed.',
  },
];

export const INDUSTRY_SCHEMA_ITEMS = INDUSTRIES.map((industry) => ({
  name: industry.name,
  href: industry.href,
  desc: industry.desc,
}));