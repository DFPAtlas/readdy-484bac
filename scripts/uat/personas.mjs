export const DEFAULT_RUN_ID = 'launch-2026-11';

export const personas = [
  {
    key: 'client-free',
    kind: 'client',
    fullName: 'UAT Free Client',
    companyName: 'Red Lion UAT Venue',
    clientType: 'venue',
    planSlug: 'client_free',
    planName: 'Free Starter',
    industry: 'Hospitality',
  },
  {
    key: 'client-pro',
    kind: 'client',
    fullName: 'UAT Pro Client',
    companyName: 'Urban Nights UAT Events',
    clientType: 'event_organiser',
    planSlug: 'client-pro',
    planName: 'Client Pro',
    industry: 'Events',
  },
  {
    key: 'client-cancelled',
    kind: 'client',
    fullName: 'UAT Cancelled Client',
    companyName: 'Apex Build UAT Ltd',
    clientType: 'business',
    planSlug: 'client_free',
    planName: 'Free Starter',
    industry: 'Construction',
  },
  {
    key: 'guard-door',
    kind: 'guard',
    fullName: 'UAT Door Supervisor',
    licenceType: 'door_supervisor',
    verification: 'verified',
    siaStatus: 'valid',
    planSlug: 'guard-free',
    planName: 'Guard Free',
  },
  {
    key: 'guard-cctv',
    kind: 'guard',
    fullName: 'UAT CCTV Guard',
    licenceType: 'cctv',
    verification: 'verified',
    siaStatus: 'valid',
    planSlug: 'guard-free',
    planName: 'Guard Free',
  },
  {
    key: 'guard-pending',
    kind: 'guard',
    fullName: 'UAT Pending Guard',
    licenceType: 'security_guard',
    verification: 'pending_sia_check',
    siaStatus: 'not_found',
    planSlug: 'guard-free',
    planName: 'Guard Free',
  },
  {
    key: 'guard-expired',
    kind: 'guard',
    fullName: 'UAT Expired Guard',
    licenceType: 'door_supervisor',
    verification: 'suspended',
    siaStatus: 'expired',
    planSlug: 'guard-free',
    planName: 'Guard Free',
  },
];

export function plusAddress(inbox, runId, tag) {
  const at = inbox.lastIndexOf('@');
  if (at < 1) throw new Error('QG_UAT_INBOX must be a valid email address');
  return `${inbox.slice(0, at)}+qg-${runId}-${tag}${inbox.slice(at)}`.toLowerCase();
}

