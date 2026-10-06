import { sanitiseTime } from './post-job-validation';

export const PENDING_JOB_DRAFT_KEY = 'qg_pending_job_draft_v1';
export const PENDING_JOB_DRAFT_VERSION = 1;
export const PENDING_JOB_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const IMMEDIATE_BOOKING_RETURN_PATH = '/client/post-job?mode=immediate&source=homepage';

export interface PendingJobDraft {
  version: number;
  mode: 'immediate';
  source: string;
  venueCategory: string;
  venueName: string;
  addressLine1: string;
  city: string;
  postcode: string;
  startDate: string;
  startTime: string;
  endTime: string;
  numberOfGuards: string;
  numberOfDays: string;
  bookingType: string;
  requiredLicenseType: string;
  hourlyRate: string;
  jobDescription: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: string;
  submissionId: string;
}

export type PendingJobDraftInput = Omit<PendingJobDraft, 'version' | 'createdAt' | 'mode' | 'submissionId'> & {
  mode?: 'immediate';
  submissionId?: string;
};

export function createSubmissionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `qgb_${crypto.randomUUID().replace(/-/g, '')}`;
    }
  } catch {}
  return `qgb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

const VENUE_LABELS: Record<string, string> = {
  nightclub_bar: 'Nightclub or Bar',
  retail_shop: 'Retail or Shop',
  construction_site: 'Construction Site',
  private_event: 'Private Event',
  festival_public_event: 'Festival / Public Event',
  warehouse_property: 'Warehouse / Property',
  office_building: 'Office Building',
  other: 'Security Job',
};

const VENUE_TO_SECURITY_TYPE: Record<string, string> = {
  nightclub_bar: 'door-supervisor',
  retail_shop: 'retail-security',
  construction_site: 'security-guard',
  private_event: 'event-security',
  festival_public_event: 'event-security',
  warehouse_property: 'mobile-patrol',
  office_building: 'security-guard',
  other: 'security-guard',
};

const LICENCE_TO_SECURITY_TYPE: Record<string, string> = {
  door_supervisor: 'door-supervisor',
  security_guard: 'security-guard',
  cctv: 'cctv-operator',
  close_protection: 'close-protection',
  dog_handler: 'dog-handler',
};

const LICENCE_LABELS: Record<string, string[]> = {
  door_supervisor: ['Door Supervisor'],
  security_guard: ['Security Guard'],
  cctv: ['CCTV Operator'],
  close_protection: ['Close Protection'],
  dog_handler: ['Dog Handler'],
  any: [],
};

export function deriveClientSecurityType(venueCategory: string, requiredLicenseType: string): string {
  if (requiredLicenseType && requiredLicenseType !== 'any') {
    return LICENCE_TO_SECURITY_TYPE[requiredLicenseType] || VENUE_TO_SECURITY_TYPE[venueCategory] || 'security-guard';
  }
  return VENUE_TO_SECURITY_TYPE[venueCategory] || 'security-guard';
}

export function computeEndDate(startDate: string, numberOfDays: string): string {
  if (!startDate) return '';
  const days = parseInt(numberOfDays, 10);
  if (!Number.isFinite(days) || days < 1) return startDate;
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().split('T')[0];
}

export function buildPendingJobDraft(input: PendingJobDraftInput): PendingJobDraft {
  return {
    version: PENDING_JOB_DRAFT_VERSION,
    mode: 'immediate',
    source: input.source || 'post-job',
    venueCategory: input.venueCategory || '',
    venueName: input.venueName || '',
    addressLine1: input.addressLine1 || '',
    city: input.city || '',
    postcode: input.postcode || '',
    startDate: input.startDate || '',
    startTime: input.startTime || '',
    endTime: input.endTime || '',
    numberOfGuards: input.numberOfGuards || '1',
    numberOfDays: input.numberOfDays || '1',
    bookingType: input.bookingType || 'one_off_shift',
    requiredLicenseType: input.requiredLicenseType || '',
    hourlyRate: input.hourlyRate || '',
    jobDescription: input.jobDescription || '',
    contactName: input.contactName || '',
    contactPhone: input.contactPhone || '',
    contactEmail: input.contactEmail || '',
    createdAt: new Date().toISOString(),
    submissionId: input.submissionId || createSubmissionId(),
  };
}

export function savePendingJobDraft(draft: PendingJobDraft): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PendingJobDraft = {
      ...draft,
      version: PENDING_JOB_DRAFT_VERSION,
      createdAt: draft.createdAt || new Date().toISOString(),
    };
    localStorage.setItem(PENDING_JOB_DRAFT_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(PENDING_JOB_DRAFT_KEY);
  } catch {}
}

function isPendingJobDraftExpired(draft: PendingJobDraft): boolean {
  const created = Date.parse(draft.createdAt || '');
  if (!Number.isFinite(created)) return true;
  return Date.now() - created > PENDING_JOB_DRAFT_TTL_MS;
}

export function loadPendingJobDraft(): PendingJobDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    let raw = localStorage.getItem(PENDING_JOB_DRAFT_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(PENDING_JOB_DRAFT_KEY);
      if (legacy) {
        raw = legacy;
        try { localStorage.setItem(PENDING_JOB_DRAFT_KEY, legacy); } catch {}
        try { sessionStorage.removeItem(PENDING_JOB_DRAFT_KEY); } catch {}
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== PENDING_JOB_DRAFT_VERSION || parsed.mode !== 'immediate') {
      clearPendingJobDraft();
      return null;
    }
    const candidate: PendingJobDraft = {
      ...parsed,
      createdAt: parsed.createdAt || parsed.savedAt || '',
    };
    if (isPendingJobDraftExpired(candidate)) {
      clearPendingJobDraft();
      return null;
    }
    if (!candidate.submissionId) {
      candidate.submissionId = createSubmissionId();
      try { localStorage.setItem(PENDING_JOB_DRAFT_KEY, JSON.stringify(candidate)); } catch {}
    }
    return candidate;
  } catch {
    clearPendingJobDraft();
    return null;
  }
}

export function hasPendingJobDraft(): boolean {
  return loadPendingJobDraft() !== null;
}

export function clearPendingJobDraft(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(PENDING_JOB_DRAFT_KEY); } catch {}
  try { sessionStorage.removeItem(PENDING_JOB_DRAFT_KEY); } catch {}
}

export function getPendingBookingReturnPath(): string | null {
  return loadPendingJobDraft() ? IMMEDIATE_BOOKING_RETURN_PATH : null;
}

export function mapPendingDraftToClientForm(draft: PendingJobDraft): Record<string, unknown> {
  const jobTypeLabel = VENUE_LABELS[draft.venueCategory] || 'Security Job';
  const endDate = computeEndDate(draft.startDate, draft.numberOfDays);
  return {
    jobTitle: draft.venueName ? `${draft.venueName} — ${jobTypeLabel}` : `${jobTypeLabel} Booking`,
    securityType: deriveClientSecurityType(draft.venueCategory, draft.requiredLicenseType),
    venue: draft.venueName || '',
    addressLine1: draft.addressLine1 || '',
    city: draft.city || '',
    postcode: draft.postcode || '',
    startDate: draft.startDate || '',
    endDate: endDate || '',
    startTime: sanitiseTime(draft.startTime),
    endTime: sanitiseTime(draft.endTime),
    numberOfGuards: draft.numberOfGuards || '1',
    numberOfDays: draft.numberOfDays || '1',
    siaLicenceRequired: 'yes',
    specificLicences: LICENCE_LABELS[draft.requiredLicenseType] || [],
    hourlyRate: draft.hourlyRate || '',
    jobDescription: draft.jobDescription || '',
    contactName: draft.contactName || '',
    contactPhone: draft.contactPhone || '',
    contactEmail: draft.contactEmail || '',
    repeatShift: draft.bookingType === 'weekly_recurring' ? 'weekly' : 'none',
    urgency: 'immediate',
  };
}