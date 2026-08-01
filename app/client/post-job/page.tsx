'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';
import DraftManager from './DraftManager';
import TemplateManager from './TemplateManager';
import SaveTemplateModal from './SaveTemplateModal';
import DuplicateJobModal from './DuplicateJobModal';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import WizardStepIndicator from './WizardStepIndicator';
import StepJobBasics from './StepJobBasics';
import StepLocation from './StepLocation';
import StepShiftDates from './StepShiftDates';
import StepGuardRequirements from './StepGuardRequirements';
import StepPayBudget from './StepPayBudget';
import StepReviewPost from './StepReviewPost';
import FirstJobHelper from './FirstJobHelper';
import ContextualHelpCard from '@/app/client/help/ContextualHelpCard';
import { Suspense } from 'react';
import { sanitiseTime, getStepErrors, validateAllSteps, stepFieldMap } from '@/lib/post-job-validation';
import ClientOnboardingAgent from '@/components/ClientOnboardingAgent';

const defaultFormData = {
  jobTitle: '',
  securityType: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  breakInfo: '',
  repeatShift: 'none',
  repeatFrequency: '',
  repeatEndDate: '',
  numberOfDays: '1',
  numberOfGuards: '1',
  siaLicenceRequired: 'yes',
  specificLicences: [] as string[],
  venue: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postcode: '',
  siteContactName: '',
  siteContactPhone: '',
  siteInstructions: '',
  jobDescription: '',
  experienceLevel: '',
  uniformRequired: 'no',
  uniformDetails: '',
  drivingRequired: 'no',
  dressCode: '',
  specialInstructions: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  publishAt: '',
  expiresAt: '',
  isFeatured: false,
  isUrgent: false,
  autoCloseOnExpiry: true,
  featuredDuration: '7',
  additionalRequirements: '',
  hourlyRate: '',
  savedSiteId: '',
  urgency: 'standard',
};

const WARNING_LABELS: Record<string, string> = {
  geocoding_failed: 'Address could not be geocoded. The job is posted but location may not show on maps.',
  email_failed: 'Confirmation email could not be sent. Your job is still live.',
  notification_failed: 'Guard notifications could not be sent. Your job is still live.',
  usage_record_failed: 'Usage tracking was not updated. Contact support if you see issues.',
  activity_log_failed: 'Activity was not logged. Contact support if you see issues.',
};

function PostJobContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, allowed, userId, clientData } = useClientGuard();
  const { checking, blocked } = useRouteGuard(userId);
  const [formData, setFormData] = useState({ ...defaultFormData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [postSubmitWarnings, setPostSubmitWarnings] = useState<string[]>([]);

  const [sidebarInfo, setSidebarInfo] = useState({ companyName: 'Client', subscriptionTier: 'Free', initials: 'CL' });

  const [showDrafts, setShowDrafts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [savedSites, setSavedSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [toastMessage, setToastMessage] = useState('');
  const [paygServiceFeePct, setPaygServiceFeePct] = useState(15);
  const [startFrom, setStartFrom] = useState<'blank' | 'template' | 'site' | 'previous'>('blank');

  const clientId = clientData?.id || null;

  useEffect(() => {
    const fetchPricingConfig = async () => {
      const { data } = await supabase.from('pricing_config').select('payg_service_fee_pct').order('id', { ascending: true }).limit(1).maybeSingle();
      if (data?.payg_service_fee_pct != null) {
        setPaygServiceFeePct(Number(data.payg_service_fee_pct));
      }
    };
    fetchPricingConfig();
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!clientData || !userId || !allowed) return;

    setSidebarInfo({
      companyName: clientData.company_name || 'Client',
      subscriptionTier: clientData.subscription_tier || 'Free',
      initials: (clientData.company_name || 'Client').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    });

    setFormData(prev => ({
      ...prev,
      contactName: clientData.contact_name || (prev.contactName || ''),
      contactEmail: clientData.email || (prev.contactEmail || ''),
      contactPhone: clientData.phone || (prev.contactPhone || ''),
    }));

    loadDraftsAndTemplates(clientData.id);
    loadSavedSites(clientData.id);
  }, [clientData, userId, allowed]);

  const loadDraftsAndTemplates = async (cId: string) => {
    const [draftsRes, templatesRes] = await Promise.all([
      supabase.schema('app').from('job_drafts').select('*').eq('client_id', cId).order('last_saved_at', { ascending: false }),
      supabase.schema('app').from('job_templates').select('*').eq('client_id', cId).order('use_count', { ascending: false }),
    ]);
    setDrafts(draftsRes.data || []);
    setTemplates(templatesRes.data || []);
  };

  const loadSavedSites = async (cId: string) => {
    setSitesLoading(true);
    const { data } = await supabase.from('saved_sites').select('*').eq('client_id', cId).eq('archived', false).order('created_at', { ascending: false });
    setSavedSites(data || []);
    setSitesLoading(false);
  };

  const refreshSavedSites = async () => {
    if (!clientId) return;
    const { data } = await supabase.from('saved_sites').select('*').eq('client_id', clientId).eq('archived', false).order('created_at', { ascending: false });
    setSavedSites(data || []);
  };

  useEffect(() => {
    const templateId = searchParams.get('template');
    const siteId = searchParams.get('site');
    if (templateId && templates.length > 0) {
      const t = templates.find(tpl => tpl.id === templateId);
      if (t) {
        loadTemplate(t);
        setStartFrom('template');
      }
    }
    if (siteId && savedSites.length > 0) {
      const s = savedSites.find(sit => sit.id === siteId);
      if (s) {
        applySavedSite(s);
        setStartFrom('site');
      }
    }
  }, [searchParams, templates, savedSites]);

  const applySavedSite = (site: any) => {
    setFormData(prev => ({
      ...prev,
      savedSiteId: site.id,
      venue: site.site_name || '',
      addressLine1: site.address_line1 || '',
      addressLine2: site.address_line2 || '',
      city: site.city || '',
      postcode: site.postcode || '',
      siteContactName: site.site_contact_name || '',
      siteContactPhone: site.site_contact_phone || '',
      siteInstructions: [site.access_instructions, site.parking_details, site.risk_notes].filter(Boolean).join('\n\n'),
    }));
    setToastMessage('Site details loaded');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let newValue: any = value;
    if (name === 'isFeatured' || name === 'isUrgent' || name === 'autoCloseOnExpiry') {
      if (typeof value === 'boolean') {
        newValue = value;
      } else if (value === 'true') {
        newValue = true;
      } else if (value === 'false') {
        newValue = false;
      } else if (type === 'checkbox') {
        newValue = (e.target as HTMLInputElement).checked;
      }
    }
    setFormData(prev => ({ ...prev, [name]: newValue }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCheckboxChange = (licence: string) => {
    setFormData(prev => ({
      ...prev,
      specificLicences: prev.specificLicences.includes(licence)
        ? prev.specificLicences.filter(l => l !== licence)
        : [...prev.specificLicences, licence],
    }));
  };

  const saveDraft = useCallback(async () => {
    if (!clientId) return;
    setDraftSaveStatus('saving');
    try {
      if (currentDraftId) {
        await supabase.schema('app').from('job_drafts').update({
          draft_name: formData.jobTitle || 'Untitled Draft',
          form_data: formData,
          last_saved_at: new Date().toISOString(),
        }).eq('id', currentDraftId);
      } else {
        const { data } = await supabase.schema('app').from('job_drafts').insert({
          client_id: clientId,
          draft_name: formData.jobTitle || 'Untitled Draft',
          form_data: formData,
        }).select().maybeSingle();
        if (data) setCurrentDraftId(data.id);
      }
      setDraftSaveStatus('saved');
      setToastMessage('Draft saved successfully');
      if (clientId) loadDraftsAndTemplates(clientId);
      setTimeout(() => setDraftSaveStatus('idle'), 2000);
    } catch {
      setDraftSaveStatus('idle');
    }
  }, [clientId, currentDraftId, formData]);

  const loadDraft = (draft: any) => {
    const raw = draft.form_data || {};
    setFormData(prev => ({
      ...defaultFormData,
      ...raw,
      startTime: sanitiseTime(raw.startTime),
      endTime: sanitiseTime(raw.endTime),
      contactName: prev.contactName,
      contactEmail: prev.contactEmail,
      contactPhone: prev.contactPhone,
    }));
    setCurrentDraftId(draft.id);
    setShowDrafts(false);
    setToastMessage('Draft loaded');
    setActiveStep(1);
  };

  const deleteDraft = async (id: string) => {
    await supabase.schema('app').from('job_drafts').delete().eq('id', id);
    if (currentDraftId === id) setCurrentDraftId(null);
    if (clientId) loadDraftsAndTemplates(clientId);
  };

  const loadTemplate = async (template: any) => {
    setFormData(prev => ({
      ...defaultFormData,
      contactName: prev.contactName,
      contactEmail: prev.contactEmail,
      contactPhone: prev.contactPhone,
      jobTitle: template.job_title || '',
      securityType: template.security_type || '',
      numberOfGuards: String(template.number_of_guards || 1),
      startTime: sanitiseTime(template.start_time),
      endTime: sanitiseTime(template.end_time),
      numberOfDays: template.number_of_days || '1',
      urgency: template.urgency || 'standard',
      siaLicenceRequired: template.sia_licence_required || 'yes',
      specificLicences: template.specific_licences || [],
      experienceLevel: template.experience_level || '',
      venue: template.venue || '',
      addressLine1: template.address_line1 || '',
      addressLine2: template.address_line2 || '',
      city: template.city || '',
      postcode: template.postcode || '',
      jobDescription: template.job_description || '',
      uniformRequired: template.uniform_required || 'no',
      uniformDetails: template.uniform_details || '',
      hourlyRate: template.hourly_rate || '',
      dressCode: template.dress_code || '',
      specialInstructions: template.special_instructions || '',
      additionalRequirements: template.additional_requirements || '',
    }));
    await supabase.schema('app').from('job_templates').update({ use_count: (template.use_count || 0) + 1 }).eq('id', template.id);
    setShowTemplates(false);
    setCurrentDraftId(null);
    setToastMessage('Template loaded');
    setActiveStep(1);
    if (clientId) loadDraftsAndTemplates(clientId);
  };

  const saveTemplate = async (name: string) => {
    if (!clientId || !name.trim()) return;
    setSavingTemplate(true);
    try {
      await supabase.schema('app').from('job_templates').insert({
        client_id: clientId,
        template_name: name,
        job_title: formData.jobTitle,
        security_type: formData.securityType,
        number_of_guards: parseInt(formData.numberOfGuards),
        start_time: formData.startTime,
        end_time: formData.endTime,
        number_of_days: formData.numberOfDays,
        urgency: formData.urgency,
        sia_licence_required: formData.siaLicenceRequired,
        specific_licences: formData.specificLicences,
        experience_level: formData.experienceLevel,
        venue: formData.venue,
        address_line1: formData.addressLine1,
        address_line2: formData.addressLine2,
        city: formData.city,
        postcode: formData.postcode,
        job_description: formData.jobDescription,
        uniform_required: formData.uniformRequired,
        uniform_details: formData.uniformDetails,
        hourly_rate: formData.hourlyRate,
        dress_code: formData.dressCode,
        special_instructions: formData.specialInstructions,
        additional_requirements: formData.additionalRequirements,
      });
      setShowSaveTemplate(false);
      setToastMessage('Template saved');
      if (clientId) loadDraftsAndTemplates(clientId);
    } catch {
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.schema('app').from('job_templates').delete().eq('id', id);
    if (clientId) loadDraftsAndTemplates(clientId);
  };

  const duplicateJob = (job: any) => {
    setFormData(prev => ({
      ...defaultFormData,
      contactName: prev.contactName,
      contactEmail: prev.contactEmail,
      contactPhone: prev.contactPhone,
      jobTitle: job.job_title || '',
      securityType: job.security_type || '',
      numberOfGuards: String(job.number_of_guards || 1),
      startTime: sanitiseTime(job.start_time),
      endTime: sanitiseTime(job.end_time),
      urgency: job.urgency_level || 'standard',
      siaLicenceRequired: job.sia_licence_required ? 'yes' : 'no',
      specificLicences: job.required_licence_types || [],
      experienceLevel: job.experience_level || '',
      venue: job.venue_name || '',
      addressLine1: job.venue_address_line1 || '',
      addressLine2: job.venue_address_line2 || '',
      city: job.venue_city || '',
      postcode: job.venue_postcode || '',
      jobDescription: job.job_description || '',
      uniformRequired: job.uniform_required ? 'yes' : 'no',
      uniformDetails: job.uniform_details || '',
      hourlyRate: String(job.hourly_rate || ''),
      additionalRequirements: job.additional_requirements || '',
    }));
    setShowDuplicate(false);
    setCurrentDraftId(null);
    setToastMessage('Job details copied — update dates and submit');
    setActiveStep(1);
  };

  const validateStep = (step: number) => {
    const newErrors = getStepErrors(step, formData);
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(activeStep)) return;
    if (activeStep < 6) setActiveStep(activeStep + 1);
  };

  const prevStep = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  const handleStepClick = (stepNum: number) => {
    if (stepNum < activeStep) {
      setActiveStep(stepNum);
    } else if (stepNum > activeStep) {
      let allValid = true;
      for (let s = activeStep; s < stepNum; s++) {
        if (!validateStep(s)) {
          allValid = false;
          setActiveStep(s);
          break;
        }
      }
      if (allValid) setActiveStep(stepNum);
    }
  };

  const handlePost = async () => {
    if (!userId || !clientId) {
      setErrors({ submit: 'Authentication error. Please refresh the page.' });
      setSubmitStatus('error');
      return;
    }

    const { valid, firstInvalidStep, allErrors } = validateAllSteps(formData);
    if (!valid && firstInvalidStep) {
      setErrors(allErrors);
      setActiveStep(firstInvalidStep);
      return;
    }

    setSubmitting(true);
    setSubmitStatus('submitting');
    setPostSubmitWarnings([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setErrors({ submit: 'Authentication expired. Please refresh the page.' });
        setSubmitStatus('error');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ formData, clientId }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        const errorMap: Record<string, string> = {
          entitlement_failed: 'We could not verify your subscription plan. Please refresh or contact support.',
          limit_reached: result.message || 'You have reached your monthly job posting limit. Upgrade to post more jobs.',
          unauthorized: 'Authentication failed. Please refresh the page.',
          usage_check_failed: 'Could not verify job posting limits. Please try again.',
          insert_failed: result.message || 'Failed to create job. Please try again.',
        };
        setErrors({ submit: errorMap[result.error] || result.message || 'Failed to post job.' });
        setSubmitStatus('error');

        if (result.error === 'limit_reached') {
          setTimeout(() => {
            router.push('/upgrade?reason=job_limit_reached');
          }, 2000);
        }
        return;
      }

      setPostSubmitWarnings(result.warnings || []);

      if (currentDraftId) {
        supabase.schema('app').from('job_drafts').delete().eq('id', currentDraftId).then(() => {
          setCurrentDraftId(null);
        }).catch(() => {});
      }

      setSubmitStatus('success');
      setTimeout(() => {
        router.push('/client/jobs');
      }, 3000);
    } catch {
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
      setSubmitStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-10 sm:py-16 border-b border-[#1e2d4d]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="h-6 w-6 bg-[#162036] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[#162036] rounded animate-pulse" />
              </div>
              <div className="h-9 sm:h-10 w-48 sm:w-56 bg-[#162036] rounded animate-pulse mb-2" />
              <div className="h-4 w-64 sm:w-80 bg-[#162036] rounded animate-pulse mb-4 sm:mb-6" />
              <div className="flex flex-wrap gap-2">
                <div className="h-9 w-28 sm:w-32 bg-[#162036] rounded-lg animate-pulse" />
                <div className="h-9 w-24 sm:w-28 bg-[#162036] rounded-lg animate-pulse" />
                <div className="h-9 w-36 sm:w-40 bg-[#162036] rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 sm:-mt-6 relative z-10 mb-4">
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2 overflow-x-auto">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex items-center gap-2 flex-shrink-0 ${i < 5 ? 'flex-1' : ''}`}>
                  <div className={`h-8 sm:h-10 w-8 sm:w-10 rounded-full animate-pulse ${i === 0 ? 'bg-teal-500/20' : 'bg-[#162036]'}`} />
                  <div className="hidden sm:block h-3 w-16 bg-[#162036] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="h-4 w-28 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`h-20 sm:h-24 rounded-xl border-2 animate-pulse ${i === 0 ? 'bg-teal-500/10 border-teal-500/20' : 'bg-[#162036] border-[#1e2d4d]'}`} />
                ))}
              </div>
            </div>
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-4 sm:p-6 space-y-4 mb-6">
              <div className="h-5 w-32 bg-[#162036] rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 bg-[#162036] rounded animate-pulse" />
                    <div className="h-10 w-full bg-[#162036] rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 bg-[#162036] rounded animate-pulse" />
                <div className="h-24 w-full bg-[#162036] rounded-lg animate-pulse" />
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
                <div className="h-9 w-24 bg-[#162036] rounded-lg animate-pulse" />
                <div className="h-9 w-28 bg-teal-500/20 rounded-lg animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-2xl p-4 sm:p-6 text-center border border-[#1e2d4d]">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-xl mx-auto mb-3 animate-pulse" />
                  <div className="h-4 w-32 bg-[#162036] rounded animate-pulse mx-auto mb-2" />
                  <div className="h-3 w-40 bg-[#162036] rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          </div>
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
            <UpgradePrompt feature="client.post_job" />
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Job Basics', icon: 'ri-briefcase-line' },
    { num: 2, label: 'Location', icon: 'ri-map-pin-line' },
    { num: 3, label: 'Shift Times', icon: 'ri-calendar-schedule-line' },
    { num: 4, label: 'Requirements', icon: 'ri-shield-check-line' },
    { num: 5, label: 'Pay & Budget', icon: 'ri-money-pound-circle-line' },
    { num: 6, label: 'Review & Post', icon: 'ri-eye-line' },
  ];

  const stepHasError = (stepNum: number) =>
    stepFieldMap[stepNum].some(field => !!errors[field]);

  const startFromOptions = [
    { key: 'blank', label: 'Blank Job', icon: 'ri-file-add-line', desc: 'Start from scratch' },
    { key: 'template', label: 'Use Template', icon: 'ri-file-copy-line', desc: `${templates.length} saved` },
    { key: 'site', label: 'Use Saved Site', icon: 'ri-building-line', desc: `${savedSites.length} saved` },
    { key: 'previous', label: 'Previous Job', icon: 'ri-history-line', desc: 'Duplicate recent' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={sidebarInfo.companyName}
        subtitle={sidebarInfo.subscriptionTier}
        initials={sidebarInfo.initials}
        userId={userId}
      />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        {toastMessage && (
          <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in border border-[#1e2d4d]">
            <i className="ri-checkbox-circle-fill text-teal-400"></i>
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        )}

        {postSubmitWarnings.length > 0 && submitStatus === 'success' && (
          <div className="fixed top-24 right-6 z-50 bg-amber-500/10 text-amber-300 px-5 py-4 rounded-xl shadow-lg border border-amber-500/25 max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-error-warning-line text-amber-400"></i>
              <span className="text-sm font-semibold">Job posted with warnings</span>
            </div>
            <ul className="space-y-1">
              {postSubmitWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300/80">{WARNING_LABELS[w] || w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-10 sm:py-16 border-b border-[#1e2d4d]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/client/dashboard" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <span className="text-slate-500 text-sm">Back to Dashboard</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 text-white">Post a Security Job</h1>
            <p className="text-slate-400 text-lg mb-6">Find qualified SIA-licensed security guards for your venue or event</p>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowTemplates(true)} className="bg-[#162036] hover:bg-[#1a2642] text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 border border-[#1e2d4d]">
                <i className="ri-file-copy-line text-teal-400"></i>
                Templates {templates.length > 0 && <span className="bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded text-xs">{templates.length}</span>}
              </button>
              <button onClick={() => setShowDrafts(true)} className="bg-[#162036] hover:bg-[#1a2642] text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 border border-[#1e2d4d]">
                <i className="ri-draft-line text-teal-400"></i>
                Drafts {drafts.length > 0 && <span className="bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded text-xs">{drafts.length}</span>}
              </button>
              <button onClick={() => setShowDuplicate(true)} className="bg-[#162036] hover:bg-[#1a2642] text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 border border-[#1e2d4d]">
                <i className="ri-file-copy-2-line text-teal-400"></i>
                Duplicate Previous Job
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 sm:-mt-6 relative z-10 mb-4">
          <WizardStepIndicator
            steps={steps}
            activeStep={activeStep}
            onStepClick={handleStepClick}
            stepHasError={stepHasError}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <ClientOnboardingAgent
            clientId={clientId}
            hasJobs={false}
            isFreeOrStarter={true}
            profileCompleted={true}
            page="post-job"
          />

          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <i className="ri-rocket-line text-teal-400"></i>
              Start From
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {startFromOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setStartFrom(opt.key as any);
                    if (opt.key === 'template') setShowTemplates(true);
                    if (opt.key === 'previous') setShowDuplicate(true);
                    if (opt.key === 'site') {
                      if (savedSites.length === 1) {
                        applySavedSite(savedSites[0]);
                      } else if (savedSites.length > 1) {
                        setActiveStep(2);
                      }
                    }
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    startFrom === opt.key
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`${opt.icon} ${startFrom === opt.key ? 'text-teal-400' : 'text-slate-500'}`}></i>
                    <span className={`text-sm font-semibold ${startFrom === opt.key ? 'text-white' : 'text-slate-400'}`}>{opt.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {activeStep === 1 && (
            <ContextualHelpCard
              title="What makes a good job post?"
              tip="Be specific about shift times, venue address, and SIA licence requirements. Offering a competitive hourly rate and providing clear access instructions helps attract the best guards quickly."
              learnMoreHref="/client/help#posting-job"
              learnMoreLabel="Job posting guide"
              icon="ri-lightbulb-flash-line"
              variant="compact"
            />
          )}

          <form onSubmit={e => e.preventDefault()} className="space-y-6">
            <FirstJobHelper step={activeStep} />
            {activeStep === 1 && (
              <StepJobBasics
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={nextStep}
              />
            )}
            {activeStep === 2 && (
              <StepLocation
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={nextStep}
                onBack={prevStep}
                clientId={clientId || ''}
                savedSites={savedSites}
                loadingSites={sitesLoading}
                onSiteSaved={refreshSavedSites}
              />
            )}
            {activeStep === 3 && (
              <StepShiftDates
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            {activeStep === 4 && (
              <StepGuardRequirements
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onCheckboxChange={handleCheckboxChange}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            {activeStep === 5 && (
              <StepPayBudget
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={nextStep}
                onBack={prevStep}
                paygServiceFeePct={paygServiceFeePct}
              />
            )}
            {activeStep === 6 && (
              <StepReviewPost
                formData={formData}
                onPost={handlePost}
                onBack={prevStep}
                onSaveDraft={saveDraft}
                onSaveTemplate={() => setShowSaveTemplate(true)}
                draftSaveStatus={draftSaveStatus}
                submitting={submitting}
                submitStatus={submitStatus}
                errors={errors}
                paygServiceFeePct={paygServiceFeePct}
                onFieldChange={handleChange}
              />
            )}
          </form>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111d35] rounded-2xl p-6 text-center border border-[#1e2d4d] shadow-sm">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-shield-check-line text-teal-400 text-xl"></i>
              </div>
              <h3 className="font-semibold text-white mb-2">SIA Verified Guards</h3>
              <p className="text-sm text-slate-400">All guards are verified with valid SIA licences</p>
            </div>
            <div className="bg-[#111d35] rounded-2xl p-6 text-center border border-[#1e2d4d] shadow-sm">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-timer-flash-line text-teal-400 text-xl"></i>
              </div>
              <h3 className="font-semibold text-white mb-2">Quick Response</h3>
              <p className="text-sm text-slate-400">Receive applications within 24 hours</p>
            </div>
            <div className="bg-[#111d35] rounded-2xl p-6 text-center border border-[#1e2d4d] shadow-sm">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-500/25">
                <i className="ri-customer-service-2-line text-teal-400 text-xl"></i>
              </div>
              <h3 className="font-semibold text-white mb-2">UK Support</h3>
              <p className="text-sm text-slate-400">Dedicated support team available 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {showDrafts && (
        <DraftManager drafts={drafts} onLoadDraft={loadDraft} onDeleteDraft={deleteDraft} onClose={() => setShowDrafts(false)} />
      )}
      {showTemplates && (
        <TemplateManager templates={templates} onLoadTemplate={loadTemplate} onDeleteTemplate={deleteTemplate} onClose={() => setShowTemplates(false)} />
      )}
      {showSaveTemplate && (
        <SaveTemplateModal defaultName={formData.jobTitle} onSave={saveTemplate} onClose={() => setShowSaveTemplate(false)} saving={savingTemplate} />
      )}
      {showDuplicate && (
        <DuplicateJobModal clientId={clientId || ''} onSelectJob={duplicateJob} onClose={() => setShowDuplicate(false)} />
      )}
    </div>
  );
}

export default function PostJobPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PostJobContent />
    </Suspense>
  );
}