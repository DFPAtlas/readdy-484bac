'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';
import { geocodeAddress } from '@/lib/geocoding';
import { formatTimeForJob } from '@/lib/post-job-submit-utils';
import PortalSidebar from '@/components/PortalSidebar';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import { logClientActivity, ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '@/lib/client-activity';
import { checkClientJobLimit, recordClientJobPost } from '@/lib/guard-application-limits';

interface SavedSite {
  id: string;
  site_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  access_instructions?: string;
  parking_details?: string;
  risk_notes?: string;
  key_entry_instructions?: string;
  patrol_expectations?: string;
  uniform_requirements?: string;
  cctv_details?: string;
  status?: string;
}

interface JobRow {
  id: string;
  jobTitle: string;
  securityType: string;
  venue: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  startDate: string;
  startTime: string;
  endTime: string;
  numberOfDays: string;
  numberOfGuards: string;
  hourlyRate: string;
  jobDescription: string;
  urgency: string;
  savedSiteId: string;
  errors: Record<string, string>;
}

interface SharedSettings {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  experienceLevel: string;
  siaLicenceRequired: string;
  specificLicences: string[];
  uniformRequired: string;
  uniformDetails: string;
  dressCode: string;
  specialInstructions: string;
  additionalRequirements: string;
}

const securityTypes = [
  { value: 'door-supervisor', label: 'Door Supervisor' },
  { value: 'event-security', label: 'Event Security' },
  { value: 'retail-security', label: 'Retail Security' },
  { value: 'close-protection', label: 'Close Protection' },
  { value: 'cctv-operator', label: 'CCTV Operator' },
  { value: 'security-guard', label: 'Security Guard' },
  { value: 'mobile-patrol', label: 'Mobile Patrol' },
  { value: 'key-holding', label: 'Key Holding' },
  { value: 'dog-handler', label: 'Dog Handler' },
];

const siaLicenceTypes = [
  'Door Supervisor',
  'Security Guard',
  'CCTV Operator',
  'Close Protection',
  'Vehicle Immobiliser',
  'Key Holding',
];

const experienceLevels = [
  { value: 'entry', label: 'Entry Level (0-1 year)' },
  { value: 'intermediate', label: 'Intermediate (1-3 years)' },
  { value: 'experienced', label: 'Experienced (3-5 years)' },
  { value: 'senior', label: 'Senior (5+ years)' },
  { value: 'any', label: 'Any Experience Level' },
];

function computeEndDate(startDateStr: string, numberOfDays: number): string {
  if (!startDateStr || numberOfDays <= 1) return startDateStr;
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + (numberOfDays - 1));
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

let rowCounter = 0;
function createEmptyRow(): JobRow {
  rowCounter++;
  return {
    id: `row-${Date.now()}-${rowCounter}`,
    jobTitle: '',
    securityType: '',
    venue: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    startDate: '',
    startTime: '',
    endTime: '',
    numberOfDays: '1',
    numberOfGuards: '1',
    hourlyRate: '',
    jobDescription: '',
    urgency: 'standard',
    savedSiteId: '',
    errors: {},
  };
}

export default function BulkPostingClient() {
  const router = useRouter();
  const { checking, blocked } = useRouteGuard();

  const [clientId, setClientId] = useState<string | null>(null);
  const [sidebarInfo, setSidebarInfo] = useState({ companyName: 'Client', subscriptionTier: 'Free', initials: 'CL' });
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<JobRow[]>([createEmptyRow()]);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [shared, setShared] = useState<SharedSettings>({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    experienceLevel: '',
    siaLicenceRequired: 'yes',
    specificLicences: [],
    uniformRequired: 'no',
    uniformDetails: '',
    dressCode: '',
    specialInstructions: '',
    additionalRequirements: '',
  });
  const [sharedErrors, setSharedErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [paygServiceFeePct, setPaygServiceFeePct] = useState(15);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); router.push('/client/register'); return; }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, contact_name, email, phone, company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData) { setLoading(false); router.push('/client/register'); return; }

      setClientId(clientData.id);
      setShared(prev => ({
        ...prev,
        contactName: clientData.contact_name || '',
        contactEmail: clientData.email || '',
        contactPhone: clientData.phone || '',
      }));
      setSidebarInfo({
        companyName: clientData.company_name || 'Client',
        subscriptionTier: clientData.subscription_tier || 'Enterprise',
        initials: (clientData.company_name || 'CL').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      });

      const { data: sitesData } = await supabase
        .from('saved_sites')
        .select('*')
        .eq('client_id', clientData.id)
        .eq('archived', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setSavedSites(sitesData || []);

      const { data: configData } = await supabase.from('pricing_config').select('payg_service_fee_pct').order('id', { ascending: true }).limit(1).maybeSingle();
      if (configData?.payg_service_fee_pct != null) setPaygServiceFeePct(Number(configData.payg_service_fee_pct));

      setLoading(false);
    };
    init();
  }, [router]);

  const updateRow = (rowId: string, field: keyof JobRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: value };
      if (r.errors[field]) {
        const newErrors = { ...r.errors };
        delete newErrors[field];
        updated.errors = newErrors;
      }
      return updated;
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(r => r.id !== rowId);
    });
  };

  const updateShared = (field: keyof SharedSettings, value: any) => {
    setShared(prev => ({ ...prev, [field]: value }));
    if (sharedErrors[field]) {
      setSharedErrors(prev => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
    }
  };

  const applySiteToRow = (rowId: string, site: SavedSite) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        savedSiteId: site.id,
        venue: site.site_name,
        addressLine1: site.address_line1,
        addressLine2: site.address_line2 || '',
        city: site.city,
        postcode: site.postcode,
        errors: {},
      };
    }));
  };

  const toggleLicence = (licence: string) => {
    setShared(prev => ({
      ...prev,
      specificLicences: prev.specificLicences.includes(licence)
        ? prev.specificLicences.filter(l => l !== licence)
        : [...prev.specificLicences, licence],
    }));
  };

  const validateRow = (row: JobRow): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!row.jobTitle.trim()) errs.jobTitle = 'Required';
    if (!row.securityType) errs.securityType = 'Required';
    if (!row.venue.trim()) errs.venue = 'Required';
    if (!row.addressLine1.trim()) errs.addressLine1 = 'Required';
    if (!row.city.trim()) errs.city = 'Required';
    if (!row.postcode.trim()) errs.postcode = 'Required';
    if (!row.startDate) errs.startDate = 'Required';
    if (!row.startTime) errs.startTime = 'Required';
    if (!row.endTime) errs.endTime = 'Required';
    const nGuards = parseInt(row.numberOfGuards);
    if (isNaN(nGuards) || nGuards < 1 || nGuards > 100) errs.numberOfGuards = '1-100';
    if (!row.hourlyRate) errs.hourlyRate = 'Required';
    const rate = parseFloat(row.hourlyRate);
    if (isNaN(rate) || rate < 10) errs.hourlyRate = 'Min £10';
    return errs;
  };

  const validateShared = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!shared.contactName.trim()) errs.contactName = 'Required';
    if (!shared.contactPhone.trim()) errs.contactPhone = 'Required';
    if (!shared.contactEmail.trim()) errs.contactEmail = 'Required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (shared.contactEmail && !emailRegex.test(shared.contactEmail)) errs.contactEmail = 'Invalid email';
    if (!shared.experienceLevel) errs.experienceLevel = 'Required';
    return errs;
  };

  const handleSubmit = async () => {
    if (!clientId) return;

    const sharedErrs = validateShared();
    setSharedErrors(sharedErrs);

    const validatedRows = rows.map(r => ({ ...r, errors: validateRow(r) }));
    setRows(validatedRows);

    const hasSharedErrors = Object.keys(sharedErrs).length > 0;
    const hasRowErrors = validatedRows.some(r => Object.keys(r.errors).length > 0);

    if (hasSharedErrors || hasRowErrors) {
      setSubmitResult({ type: 'error', message: 'Please fix all errors before submitting.' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const limitCheck = await checkClientJobLimit(supabase, user.id);
    if (!limitCheck.allowed) {
      const remaining = Math.max(0, (limitCheck.limit || 1) - (limitCheck.used || 0));
      setSubmitResult({
        type: 'error',
        message: `You can only post ${remaining} more job(s) this month. You have ${validatedRows.length} jobs ready to post.`,
      });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    const geoWarnings: string[] = [];

    // Phase 1: Geocode all unique addresses in parallel
    const geoCache = new Map<string, { latitude: number; longitude: number } | null>();
    const uniqueAddresses = [...new Set(validatedRows.map(r =>
      [r.addressLine1, r.city, r.postcode, 'UK'].filter(Boolean).join(', ')
    ))];

    await Promise.all(uniqueAddresses.map(async (addr) => {
      if (geoCache.has(addr)) return;
      try {
        const geo = await geocodeAddress(addr);
        geoCache.set(addr, geo);
      } catch {
        geoCache.set(addr, null);
        geoWarnings.push(addr);
      }
    }));

    // Phase 2: Build all payloads
    const payloads = validatedRows.map(row => {
      const fullAddress = [row.addressLine1, row.city, row.postcode, 'UK'].filter(Boolean).join(', ');
      const geo = geoCache.get(fullAddress) ?? null;
      const days = parseInt(row.numberOfDays) || 1;

      return {
        client_id: clientId,
        job_title: row.jobTitle.trim(),
        security_type: row.securityType,
        job_description: row.jobDescription.trim() || null,
        venue_name: row.venue.trim(),
        venue_address_line1: row.addressLine1.trim(),
        venue_address_line2: row.addressLine2.trim() || null,
        venue_city: row.city.trim(),
        venue_postcode: row.postcode.trim(),
        number_of_guards: parseInt(row.numberOfGuards),
        number_of_days: days,
        start_date: row.startDate,
        end_date: computeEndDate(row.startDate, days),
        start_time: formatTimeForJob(row.startTime),
        end_time: formatTimeForJob(row.endTime),
        hourly_rate: parseFloat(row.hourlyRate),
        sia_licence_required: shared.siaLicenceRequired === 'yes',
        required_licence_types: shared.specificLicences.length > 0 ? shared.specificLicences : null,
        uniform_required: shared.uniformRequired === 'yes',
        uniform_details: shared.uniformDetails.trim() || null,
        experience_level: shared.experienceLevel,
        dress_code: shared.dressCode.trim() || null,
        special_instructions: shared.specialInstructions.trim() || null,
        additional_requirements: shared.additionalRequirements.trim() || null,
        saved_site_id: row.savedSiteId || null,
        urgency: row.urgency,
        contact_name: shared.contactName,
        contact_phone: shared.contactPhone,
        contact_email: shared.contactEmail,
        status: 'open',
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        geocoded_at: geo ? new Date().toISOString() : null,
        repeat_pattern: 'one-off',
        is_recurring: false,
        is_featured: false,
        is_urgent: row.urgency === 'urgent' || row.urgency === 'immediate',
        is_draft: false,
        auto_close_on_expiry: true,
      };
    });

    // Phase 3: Insert with controlled concurrency (chunks of 5)
    const CONCURRENCY = 5;
    const insertResults: PromiseSettledResult<{ error: any }>[] = [];
    for (let i = 0; i < payloads.length; i += CONCURRENCY) {
      const chunk = payloads.slice(i, i + CONCURRENCY);
      const chunkPromises = chunk.map(p => supabase.from('jobs').insert(p));
      const chunkResults = await Promise.allSettled(chunkPromises);
      insertResults.push(...chunkResults);
    }

    let successCount = 0;
    let failCount = 0;
    insertResults.forEach(r => {
      if (r.status === 'fulfilled' && !r.value.error) {
        successCount++;
      } else {
        failCount++;
      }
    });

    // Phase 4: Record usage for successful jobs
    let usageWarning = '';
    if (successCount > 0) {
      const usageResults = await Promise.all(
        Array.from({ length: successCount }).map(() => recordClientJobPost(supabase, user.id))
      );
      const usageFailures = usageResults.filter(r => !r.allowed).length;
      if (usageFailures > 0) {
        usageWarning = `Usage tracking failed for ${usageFailures} job(s). Contact support if your limits appear incorrect.`;
      }
    }

    // Phase 5: Activity log
    try {
      await logClientActivity({
        action_type: ACTIVITY_TYPES.JOB_CREATED,
        action_description: `Bulk posted ${successCount} jobs (${failCount} failed)`,
        category: ACTIVITY_CATEGORIES.JOB,
        metadata: { bulk: true, successCount, failCount, total: validatedRows.length },
      });
    } catch {}

    setSubmitting(false);

    // Phase 6: Build result message
    let message = '';
    let resultType: 'success' | 'error' = 'error';
    if (failCount === 0) {
      message = `All ${successCount} jobs posted successfully!`;
      resultType = 'success';
    } else if (successCount > 0) {
      message = `${successCount} jobs posted, ${failCount} failed. Please check and retry the failed ones.`;
    } else {
      message = 'All jobs failed to post. Please try again.';
    }
    if (geoWarnings.length > 0) {
      message += ` ${geoWarnings.length} address(es) could not be geocoded.`;
    }
    if (usageWarning) {
      message += ` ${usageWarning}`;
    }
    setSubmitResult({ type: resultType, message });
    if (failCount === 0) {
      setTimeout(() => router.push('/client/jobs'), 2000);
    }
  };

  const totalJobs = rows.length;
  const totalGuards = rows.reduce((sum, r) => sum + (parseInt(r.numberOfGuards) || 0), 0);
  const estimatedTotal = rows.reduce((sum, r) => {
    const rate = parseFloat(r.hourlyRate) || 0;
    const guards = parseInt(r.numberOfGuards) || 0;
    const days = parseInt(r.numberOfDays) || 1;
    let hours = 8;
    if (r.startTime && r.endTime) {
      const [sh, sm] = r.startTime.split(':').map(Number);
      const [eh, em] = r.endTime.split(':').map(Number);
      hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    }
    const fees = calculatePaygFees({ hourlyRate: rate, hours, numberOfGuards: guards, numberOfDays: days, serviceFeePct: paygServiceFeePct });
    return sum + fees.total;
  }, 0);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Enterprise" initials="CL" />
        <div className="flex-1 min-h-screen flex items-center justify-center">
          <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName={sidebarInfo.companyName} subtitle={sidebarInfo.subscriptionTier} initials={sidebarInfo.initials} />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.bulk_posting" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={sidebarInfo.companyName}
        subtitle={sidebarInfo.subscriptionTier}
        initials={sidebarInfo.initials}
      />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-10 sm:py-16 border-b border-[#1e2d4d]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/client/dashboard" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <span className="text-slate-500 text-sm">Back to Dashboard</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-violet-500/20 rounded-2xl border border-violet-400/25 flex items-center justify-center">
                <i className="ri-stack-line text-2xl text-violet-400"></i>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">Bulk Job Posting</h1>
                <p className="text-slate-400 text-sm mt-1">Post multiple security jobs in one go — fill out shared settings then add each job below</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {submitResult && (
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              submitResult.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-400/20'
                : 'bg-red-500/10 border border-red-400/20'
            }`}>
              <i className={`${submitResult.type === 'success' ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-error-warning-fill text-red-400'} text-lg flex-shrink-0 mt-0.5`}></i>
              <p className={`text-sm ${submitResult.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{submitResult.message}</p>
            </div>
          )}

          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-teal-500/15 rounded-xl border border-teal-400/20 flex items-center justify-center">
                <i className="ri-settings-3-line text-teal-400 text-lg"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Shared Settings</h2>
                <p className="text-xs text-slate-400">Applied to all jobs in this batch</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Contact Name *</label>
                <input
                  type="text"
                  value={shared.contactName}
                  onChange={e => updateShared('contactName', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Your name"
                />
                {sharedErrors.contactName && <p className="text-red-400 text-xs mt-1">{sharedErrors.contactName}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Contact Phone *</label>
                <input
                  type="text"
                  value={shared.contactPhone}
                  onChange={e => updateShared('contactPhone', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Phone number"
                />
                {sharedErrors.contactPhone && <p className="text-red-400 text-xs mt-1">{sharedErrors.contactPhone}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Contact Email *</label>
                <input
                  type="email"
                  value={shared.contactEmail}
                  onChange={e => updateShared('contactEmail', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
                {sharedErrors.contactEmail && <p className="text-red-400 text-xs mt-1">{sharedErrors.contactEmail}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Experience Level *</label>
                <div className="relative">
                  <select
                    value={shared.experienceLevel}
                    onChange={e => updateShared('experienceLevel', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm pr-8 appearance-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select level</option>
                    {experienceLevels.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
                {sharedErrors.experienceLevel && <p className="text-red-400 text-xs mt-1">{sharedErrors.experienceLevel}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">SIA Licence Required</label>
                <div className="flex gap-3 mt-1">
                  {[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateShared('siaLicenceRequired', opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        shared.siaLicenceRequired === opt.value
                          ? 'bg-teal-500 text-white'
                          : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:border-[#2a3d5f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {shared.siaLicenceRequired === 'yes' && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-300 mb-2">Specific Licence Types</label>
                <div className="flex flex-wrap gap-2">
                  {siaLicenceTypes.map(licence => (
                    <button
                      key={licence}
                      type="button"
                      onClick={() => toggleLicence(licence)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        shared.specificLicences.includes(licence)
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:border-[#2a3d5f]'
                      }`}
                    >
                      {licence}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Dress Code</label>
                <input
                  type="text"
                  value={shared.dressCode}
                  onChange={e => updateShared('dressCode', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., Black suit, white shirt"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Uniform Required</label>
                <div className="flex gap-3 mt-1">
                  {[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateShared('uniformRequired', opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        shared.uniformRequired === opt.value
                          ? 'bg-teal-500 text-white'
                          : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:border-[#2a3d5f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {shared.uniformRequired === 'yes' && (
                  <input
                    type="text"
                    value={shared.uniformDetails}
                    onChange={e => updateShared('uniformDetails', e.target.value)}
                    className="w-full mt-2 px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Uniform details"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Special Instructions</label>
                <textarea
                  value={shared.specialInstructions}
                  onChange={e => updateShared('specialInstructions', e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  placeholder="Any special instructions for all jobs"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Additional Requirements</label>
                <textarea
                  value={shared.additionalRequirements}
                  onChange={e => updateShared('additionalRequirements', e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  placeholder="Additional requirements for all jobs"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-500/15 rounded-xl border border-violet-400/20 flex items-center justify-center">
                  <i className="ri-list-check-2 text-violet-400 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Job List</h2>
                  <p className="text-xs text-slate-400">{totalJobs} job{totalJobs !== 1 ? 's' : ''} · {totalGuards} guard{totalGuards !== 1 ? 's' : ''} total · Est. £{estimatedTotal.toFixed(0)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Add Job
              </button>
            </div>

            <div className="space-y-4">
              {savedSites.length > 0 && (
                <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 flex items-center gap-3">
                  <i className="ri-building-line text-teal-400 text-sm"></i>
                  <span className="text-xs text-slate-400">Tip: Select a saved site from each row&apos;s dropdown to auto-fill the address.</span>
                  <Link href="/client/sites" className="text-xs text-teal-400 hover:text-teal-300 font-semibold ml-auto cursor-pointer whitespace-nowrap">
                    Manage Sites <i className="ri-arrow-right-line ml-0.5"></i>
                  </Link>
                </div>
              )}
              {rows.map((row, idx) => (
                <div key={row.id} className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                        Job #{idx + 1}
                      </span>
                      {savedSites.length > 0 && (
                        <div className="relative">
                          <select
                            value={row.savedSiteId}
                            onChange={e => {
                              const site = savedSites.find(s => s.id === e.target.value);
                              if (site) applySiteToRow(row.id, site);
                              else updateRow(row.id, 'savedSiteId', '');
                            }}
                            className="px-2 py-1 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-white text-[10px] pr-5 appearance-none cursor-pointer focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">Select site...</option>
                            {savedSites.map(s => (
                              <option key={s.id} value={s.id}>{s.site_name}</option>
                            ))}
                          </select>
                          <i className="ri-arrow-down-s-line absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]"></i>
                        </div>
                      )}
                      {row.savedSiteId && (
                        <button
                          type="button"
                          onClick={() => {
                            updateRow(row.id, 'savedSiteId', '');
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-close-line mr-0.5"></i>Clear
                        </button>
                      )}
                    </div>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Job Title *</label>
                      <input
                        type="text"
                        value={row.jobTitle}
                        onChange={e => updateRow(row.id, 'jobTitle', e.target.value)}
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.jobTitle ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        placeholder="e.g., Nightclub Door Supervisor"
                      />
                      {row.errors.jobTitle && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.jobTitle}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Type *</label>
                      <div className="relative">
                        <select
                          value={row.securityType}
                          onChange={e => updateRow(row.id, 'securityType', e.target.value)}
                          className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs pr-6 appearance-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.securityType ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        >
                          <option value="">Select</option>
                          {securityTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"></i>
                      </div>
                      {row.errors.securityType && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.securityType}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Venue *</label>
                      <input
                        type="text"
                        value={row.venue}
                        onChange={e => updateRow(row.id, 'venue', e.target.value)}
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.venue ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        placeholder="Venue name"
                      />
                      {row.errors.venue && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.venue}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Date *</label>
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={e => updateRow(row.id, 'startDate', e.target.value)}
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.startDate ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                      />
                      {row.errors.startDate && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.startDate}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Start *</label>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={e => updateRow(row.id, 'startTime', e.target.value)}
                          className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.startTime ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        />
                        {row.errors.startTime && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.startTime}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">End *</label>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={e => updateRow(row.id, 'endTime', e.target.value)}
                          className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.endTime ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        />
                        {row.errors.endTime && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.endTime}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Guards *</label>
                      <input
                        type="number"
                        value={row.numberOfGuards}
                        onChange={e => updateRow(row.id, 'numberOfGuards', e.target.value)}
                        min="1" max="100"
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.numberOfGuards ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                      />
                      {row.errors.numberOfGuards && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.numberOfGuards}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Days</label>
                      <input
                        type="number"
                        value={row.numberOfDays}
                        onChange={e => updateRow(row.id, 'numberOfDays', e.target.value)}
                        min="1" max="365"
                        className="w-full px-2.5 py-2 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Rate (£/hr) *</label>
                      <input
                        type="number"
                        value={row.hourlyRate}
                        onChange={e => updateRow(row.id, 'hourlyRate', e.target.value)}
                        min="10" step="0.50"
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.hourlyRate ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        placeholder="£15.00"
                      />
                      {row.errors.hourlyRate && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.hourlyRate}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Urgency</label>
                      <div className="relative">
                        <select
                          value={row.urgency}
                          onChange={e => updateRow(row.id, 'urgency', e.target.value)}
                          className="w-full px-2.5 py-2 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-white text-xs pr-6 appearance-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <option value="standard">Standard</option>
                          <option value="urgent">Urgent</option>
                          <option value="immediate">Immediate</option>
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"></i>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Address *</label>
                      <input
                        type="text"
                        value={row.addressLine1}
                        onChange={e => updateRow(row.id, 'addressLine1', e.target.value)}
                        className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.addressLine1 ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                        placeholder="Street address"
                      />
                      {row.errors.addressLine1 && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.addressLine1}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">City *</label>
                        <input
                          type="text"
                          value={row.city}
                          onChange={e => updateRow(row.id, 'city', e.target.value)}
                          className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.city ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                          placeholder="City"
                        />
                        {row.errors.city && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Postcode *</label>
                        <input
                          type="text"
                          value={row.postcode}
                          onChange={e => updateRow(row.id, 'postcode', e.target.value)}
                          className={`w-full px-2.5 py-2 bg-[#111d35] border rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent ${row.errors.postcode ? 'border-red-500' : 'border-[#1e2d4d]'}`}
                          placeholder="Postcode"
                        />
                        {row.errors.postcode && <p className="text-red-400 text-[10px] mt-0.5">{row.errors.postcode}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Description <span className="font-normal text-slate-500">(optional, {(row.jobDescription || '').length}/500)</span></label>
                    <textarea
                      value={row.jobDescription}
                      onChange={e => updateRow(row.id, 'jobDescription', e.target.value)}
                      maxLength={500}
                      rows={1}
                      className="w-full px-2.5 py-2 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                      placeholder="Brief job description"
                    />
                  </div>

                  {row.hourlyRate && row.startTime && row.endTime && (() => {
                    const rate = parseFloat(row.hourlyRate) || 0;
                    const guards = parseInt(row.numberOfGuards) || 1;
                    const days = parseInt(row.numberOfDays) || 1;
                    const [sh, sm] = row.startTime.split(':').map(Number);
                    const [eh, em] = row.endTime.split(':').map(Number);
                    const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                    const fees = calculatePaygFees({ hourlyRate: rate, hours, numberOfGuards: guards, numberOfDays: days, serviceFeePct: paygServiceFeePct });
                    return (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <span>{guards} guard{guards !== 1 ? 's' : ''} × {hours.toFixed(1)}h × £{rate.toFixed(2)}/hr</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-teal-400 font-semibold">Total: {formatCurrency(fees.total)}</span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e2d4d] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-400">
                <span className="text-white font-semibold">{totalJobs} job{totalJobs !== 1 ? 's' : ''}</span> ready to post
                <span className="mx-2 text-slate-600">·</span>
                <span className="text-white font-semibold">{totalGuards} guard{totalGuards !== 1 ? 's' : ''}</span> needed
                <span className="mx-2 text-slate-600">·</span>
                Estimated total: <span className="text-teal-400 font-bold">£{estimatedTotal.toFixed(0)}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-3 rounded-xl font-bold text-base transition-all cursor-pointer whitespace-nowrap shadow-lg hover:shadow-teal-500/20 disabled:opacity-60 disabled:cursor-wait"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Posting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <i className="ri-send-plane-fill"></i>
                    Post All {totalJobs} Jobs
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#111d35] rounded-2xl p-5 text-center border border-[#1e2d4d]">
              <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-stack-line text-teal-400 text-lg"></i>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">Batch Processing</h3>
              <p className="text-xs text-slate-400">All jobs are posted sequentially with shared settings applied to each</p>
            </div>
            <div className="bg-[#111d35] rounded-2xl p-5 text-center border border-[#1e2d4d]">
              <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-shield-check-line text-teal-400 text-lg"></i>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">SIA Verified Guards</h3>
              <p className="text-xs text-slate-400">All matched guards are SIA-verified and background checked</p>
            </div>
            <div className="bg-[#111d35] rounded-2xl p-5 text-center border border-[#1e2d4d]">
              <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-flashlight-line text-teal-400 text-lg"></i>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">Instant Posting</h3>
              <p className="text-xs text-slate-400">Jobs go live immediately and guards are notified within minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}