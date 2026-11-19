import { dateOnlyToUtcDate, formatDateOnly } from './date-only';

const OPERATIONAL_SAFETY_STATUSES = ['open','pending','awaiting_guard_selection','awaiting_client_confirmation','awaiting_payment','funded','confirmed','in_progress'];
export const SAFETY_CHECK_FIELDS = ['site_address_confirmed','site_contact_available','emergency_contact_added','site_access_instructions_added','risk_notes_added','lone_worker_flagged','parking_details_added','required_sia_selected'] as const;
export const isOperationalSafetyJob = (job: {status?: string | null; is_deleted?: boolean | null}) => job.is_deleted !== true && OPERATIONAL_SAFETY_STATUSES.includes(job.status || '');
const licenceNames: Record<string,string> = { security_guard: 'Security Guard', door_supervisor: 'Door Supervisor', cctv: 'CCTV Operator', close_protection: 'Close Protection', key_holding: 'Key Holding', dog_handler: 'Dog Handler', vehicle_immobilisation: 'Vehicle Immobilisation' };
export function canonicalSafetyLicence(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let key = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (['cctv_operator','public_space_surveillance','public_space_surveillance_(cctv)'].includes(key)) key = 'cctv';
  return Object.prototype.hasOwnProperty.call(licenceNames,key) ? key : null;
}
export const licenceLabel = (value: string) => licenceNames[value] || 'Unrecognised licence type';
export function requiredSafetyLicences(job: any): string[] {
  const array = [...(Array.isArray(job.required_licence_types) ? job.required_licence_types : []), ...(Array.isArray(job.specific_licences) ? job.specific_licences : [])];
  const types = array.map(canonicalSafetyLicence).filter((x): x is string => !!x);
  const scalar = canonicalSafetyLicence(job.required_license_type);
  return [...new Set(types.length ? types : scalar ? [scalar] : [])];
}
function guardSafetyLicences(guard: any): string[] {
  return [...new Set([...(Array.isArray(guard.licence_types) ? guard.licence_types : []), guard.sia_licence_type].map(canonicalSafetyLicence).filter((x): x is string => !!x))];
}
function londonParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function londonDateOnly(now: Date): Date { const p=londonParts(now); return new Date(Date.UTC(p.year,p.month-1,p.day)); }
/** Convert the recorded UK wall-clock start; missing/invalid times never invent urgency. */
export function safetyShiftStart(job: {start_date?: string | null;start_time?: string | null}): number | null {
  const day=dateOnlyToUtcDate(job.start_date);
  const match=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(job.start_time || '');
  if(!day || !match || +match[1]>23 || +match[2]>59 || +(match[3]||0)>59) return null;
  const wall=day.getTime()+(+match[1]*3600 + +match[2]*60 + +(match[3]||0))*1000;
  let instant=wall;
  for(let n=0;n<3;n++){const p=londonParts(new Date(instant));const seen=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);instant+=wall-seen;}
  const p=londonParts(new Date(instant));
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)===wall ? instant : null;
}
export function isSafetyStartingSoon(job: any, now=new Date()): boolean {
  if(!isOperationalSafetyJob(job)) return false;
  const start=safetyShiftStart(job);return start!==null && start>=now.getTime() && start<=now.getTime()+48*3600000;
}

export interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  status: string;
  start_date: string;
  risk_level: string | null;
  lone_worker_flag: boolean;
  sia_licence_required: boolean;
  required_license_type: string | null;
  required_licence_types?: string[] | null;
  specific_licences?: string[] | null;
  start_time?: string | null;
  is_deleted?: boolean | null;
  assigned_count: number;
  number_of_guards: number;
  payment_status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  site_access_instructions: string | null;
  parking_instructions: string | null;
  safety_check?: {
    id: string;
    site_address_confirmed: boolean;
    site_contact_available: boolean;
    emergency_contact_added: boolean;
    site_access_instructions_added: boolean;
    risk_notes_added: boolean;
    lone_worker_flagged: boolean;
    parking_details_added: boolean;
    required_sia_selected: boolean;
  };
}

export interface GuardAssignment {
  id: string;
  guard_id: string;
  status: string;
  guards: {
    id: string;
    full_name: string;
    sia_licence_number: string | null;
    sia_verified: boolean;
    sia_expiry_date: string | null;
    sia_licence_type: string | null;
    licence_types?: string[] | null;
  } | null;
}

export interface Warning {
  id: string;
  jobId: string;
  jobTitle: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
}

export function buildSafetyWarnings(jobs: JobWithSafety[], assignments: Record<string, GuardAssignment[]> = {}, now = new Date()): Warning[] {
  const warnings: Warning[] = [];

  jobs.filter(isOperationalSafetyJob).forEach((job) => {
    const isSoon = isSafetyStartingSoon(job, now);
    const sc: Partial<NonNullable<JobWithSafety['safety_check']>> = job.safety_check || {};
    const jobAssignments = (assignments[job.id] || []).filter(a => !['cancelled','completed'].includes(a.status));
    const requirements = requiredSafetyLicences(job);

    if (!job.safety_check) {
      warnings.push({
        id: `${job.id}-no-safety-check`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'Safety Checklist Not Started',
        message: isSoon
          ? 'This job starts soon and no safety checklist has been completed.'
          : 'Complete the safety checklist before the job starts.',
        icon: 'ri-shield-line',
      });
    } else if (SAFETY_CHECK_FIELDS.some(key => job.safety_check?.[key] !== true)) {
      warnings.push({ id: `${job.id}-incomplete-checklist`, jobId: job.id, jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning', title: 'Safety Checklist Incomplete',
        message: 'Complete the outstanding safety checklist items before the shift starts.', icon: 'ri-shield-line' });
    }

    if (job.sia_licence_required && (!sc.required_sia_selected || requirements.length === 0)) {
      warnings.push({
        id: `${job.id}-sia`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'SIA Licence Requirement Not Confirmed',
        message: requirements.length ? `Confirm the required SIA licence selection: ${requirements.map(licenceLabel).join(', ')}.` : 'Select the required SIA licence type for this job.',
        icon: 'ri-shield-check-line',
      });
    }

    if (job.lone_worker_flag && !sc.lone_worker_flagged) {
      warnings.push({
        id: `${job.id}-lone-worker`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: 'warning',
        title: 'Lone Worker Not Flagged',
        message: 'This job has lone worker risk but the checklist has not been flagged.',
        icon: 'ri-user-location-line',
      });
    }

    if (!job.emergency_contact_name && !job.emergency_contact_phone) {
      warnings.push({
        id: `${job.id}-emergency`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'No Emergency Contact',
        message: 'Add an emergency contact for this job so guards know who to call in an emergency.',
        icon: 'ri-phone-line',
      });
    }

    if (!job.site_access_instructions && !job.parking_instructions) {
      warnings.push({
        id: `${job.id}-site-info`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: 'warning',
        title: 'Missing Site Instructions',
        message: 'Guards need access and parking instructions. Add them in Site Instructions.',
        icon: 'ri-door-open-line',
      });
    }

    jobAssignments.forEach((a) => {
      const g = a.guards;
      if (!g) {
        warnings.push({ id: `${job.id}-guard-${a.guard_id}-unavailable`, jobId: job.id, jobTitle: job.job_title, type: 'warning', title: 'Guard compliance unavailable', message: 'Assigned guard compliance could not be confirmed. Please retry or contact support.', icon: 'ri-user-unfollow-line' });
        return;
      }
      if (!g.sia_verified) {
        warnings.push({
          id: `${job.id}-guard-${g.id}-unverified`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'warning',
          title: `Guard Not Verified: ${g.full_name}`,
          message: 'No confirmed SIA verification is recorded for this assignment.',
          icon: 'ri-user-unfollow-line',
        });
      }
      if (job.sia_licence_required && !dateOnlyToUtcDate(g.sia_expiry_date)) {
        warnings.push({ id: `${job.id}-guard-${g.id}-expiry-unavailable`, jobId: job.id, jobTitle: job.job_title,
          type: 'warning', title: `SIA Expiry Unavailable: ${g.full_name}`,
          message: 'The recorded licence expiry is unavailable or invalid. Review this assignment before the shift.', icon: 'ri-shield-line' });
      }
      if (g.sia_expiry_date) {
        const expiry = dateOnlyToUtcDate(g.sia_expiry_date);
        const today = londonDateOnly(now);
        const in30d = new Date(today.getTime() + 30 * 86400000);
        if (expiry && expiry < today) {
          warnings.push({
            id: `${job.id}-guard-${g.id}-expired`,
            jobId: job.id,
            jobTitle: job.job_title,
            type: 'critical',
            title: `SIA Expired: ${g.full_name}`,
            message: `This guard's SIA licence expired on ${formatDateOnly(g.sia_expiry_date)}.`,
            icon: 'ri-shield-flash-line',
          });
        } else if (expiry && expiry <= in30d) {
          warnings.push({
            id: `${job.id}-guard-${g.id}-expiring`,
            jobId: job.id,
            jobTitle: job.job_title,
            type: 'warning',
            title: `SIA Expiring Soon: ${g.full_name}`,
            message: `This guard's SIA licence expires on ${formatDateOnly(g.sia_expiry_date)}.`,
            icon: 'ri-time-line',
          });
        }
      }
      if (job.sia_licence_required && requirements.length > 0 && !requirements.every(type => guardSafetyLicences(g).includes(type))) {
        warnings.push({
          id: `${job.id}-guard-${g.id}-licence-mismatch`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'warning',
          title: `Licence Type Mismatch: ${g.full_name}`,
          message: `Job requires ${requirements.map(licenceLabel).join(', ')}; recorded guard licence types: ${guardSafetyLicences(g).map(licenceLabel).join(', ') || 'unavailable'}.`,
          icon: 'ri-shield-keyhole-line',
        });
      }
    });

    if (job.status === 'awaiting_payment' || job.payment_status === 'pending') {
      warnings.push({
        id: `${job.id}-payment`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'Payment Not Complete',
        message: 'This job requires payment before guards can be confirmed.',
        icon: 'ri-wallet-3-line',
      });
    }

    if (isSoon && warnings.some((w) => w.jobId === job.id && (w.type === 'critical' || w.type === 'warning'))) {
      const existing = warnings.find((w) => w.id === `${job.id}-starting-soon`);
      if (!existing) {
        warnings.push({
          id: `${job.id}-starting-soon`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'critical',
          title: 'Job Starting Soon with Unresolved Issues',
          message: `This job starts on ${formatDateOnly(job.start_date)} and has outstanding safety or compliance warnings.`,
          icon: 'ri-alarm-warning-line',
        });
      }
    }
  });

  return warnings;
}

export function safetyCounts(jobs: any[], incidents: any[], warnings: Warning[]) {
  const operational=jobs.filter(isOperationalSafetyJob);
  return {
    totalJobs: operational.length,
    missingSafetyInfo: operational.filter(j=>SAFETY_CHECK_FIELDS.some(key=>j.safety_check?.[key]!==true)).length,
    highRiskJobs: operational.filter(j=>['high','urgent'].includes(j.risk_level)).length,
    complianceWarnings: warnings.length,
    missingEmergencyContacts: operational.filter(j=>!j.emergency_contact_name&&!j.emergency_contact_phone).length,
    missingSiteInstructions: operational.filter(j=>!j.site_access_instructions&&!j.parking_instructions).length,
    jobsWithSIARequired: operational.filter(j=>j.sia_licence_required).length,
    jobsLoneWorker: operational.filter(j=>j.lone_worker_flag).length,
    jobsWithIncidents: new Set(incidents.filter(i=>i.job_id).map(i=>i.job_id)).size,
    openTickets: incidents.filter(i=>!['closed','resolved'].includes(i.status)).length,
    urgentTickets: incidents.filter(i=>i.priority==='urgent'&&!['closed','resolved'].includes(i.status)).length,
  };
}
