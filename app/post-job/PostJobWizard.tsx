'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocoding';
import PromoBanner from '@/components/PromoBanner';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { hasFeature } from '@/lib/entitlements';
import UpgradeRequiredModal from '@/components/billing/UpgradeRequiredModal';

const venueCategories = [
  { key: 'nightclub_bar', label: 'Nightclub or Bar', icon: 'ri-door-open-line', desc: 'Door supervisors, crowd control', color: 'from-purple-500/10 to-pink-500/10' },
  { key: 'retail_shop', label: 'Retail or Shop', icon: 'ri-store-2-line', desc: 'Loss prevention, shop floor', color: 'from-blue-500/10 to-cyan-500/10' },
  { key: 'construction_site', label: 'Construction Site', icon: 'ri-hammer-line', desc: 'Site security, overnight patrol', color: 'from-amber-500/10 to-orange-500/10' },
  { key: 'private_event', label: 'Private Event', icon: 'ri-calendar-event-line', desc: 'Wedding, party, corporate', color: 'from-rose-500/10 to-red-500/10' },
  { key: 'festival_public_event', label: 'Festival / Public Event', icon: 'ri-group-line', desc: 'Crowd management, perimeter', color: 'from-emerald-500/10 to-teal-500/10' },
  { key: 'warehouse_property', label: 'Warehouse / Property', icon: 'ri-archive-line', desc: 'Empty property, car park patrol', color: 'from-slate-500/10 to-gray-500/10' },
  { key: 'office_building', label: 'Office Building', icon: 'ri-building-2-line', desc: 'Reception, concierge security', color: 'from-indigo-500/10 to-violet-500/10' },
  { key: 'other', label: 'Something Else', icon: 'ri-question-line', desc: 'Tell us what you need', color: 'from-teal-500/10 to-teal-500/10' },
];

const licenceTypes = [
  { value: 'door_supervisor', label: 'Door Supervisor Licence' },
  { value: 'security_guard', label: 'Security Guard Licence' },
  { value: 'cctv', label: 'CCTV Operator Licence' },
  { value: 'close_protection', label: 'Close Protection Licence' },
  { value: 'dog_handler', label: 'Dog Handler Licence' },
  { value: 'any', label: 'Any SIA Licence' },
];

const bookingTypes = [
  { value: 'one_off_shift', label: 'One-off Shift', desc: 'Single day or night' },
  { value: 'multi_day', label: 'Multi-Day', desc: '2–14 days' },
  { value: 'weekly_recurring', label: 'Weekly Recurring', desc: 'Same days every week' },
  { value: 'ongoing', label: 'Ongoing', desc: 'Open-ended contract' },
];

const venueToSecurityType: Record<string, string> = {
  nightclub_bar: 'door-supervisor',
  retail_shop: 'retail-security',
  construction_site: 'security-guard',
  private_event: 'event-security',
  festival_public_event: 'event-security',
  warehouse_property: 'mobile-patrol',
  office_building: 'security-guard',
  other: 'security-guard',
};

const licenceToSecurityType: Record<string, string> = {
  door_supervisor: 'door-supervisor',
  security_guard: 'security-guard',
  cctv: 'cctv-operator',
  close_protection: 'close-protection',
  dog_handler: 'dog-handler',
};

function deriveSecurityType(venueCategory: string, requiredLicenseType: string): string {
  if (requiredLicenseType && requiredLicenseType !== 'any') {
    return licenceToSecurityType[requiredLicenseType] || venueToSecurityType[venueCategory] || 'security-guard';
  }
  return venueToSecurityType[venueCategory] || 'security-guard';
}

interface FormData {
  venueCategory: string;
  venueName: string;
  addressLine1: string;
  city: string;
  postcode: string;
  startDate: string;
  startTime: string;
  endTime: string;
  numberOfGuards: string;
  requiredLicenseType: string;
  hourlyRate: string;
  jobDescription: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bookingType: string;
  numberOfDays: string;
}

export default function PostJobWizard() {
  const router = useSafeRouter();
  const searchParams = useSearchParams();
  const prefillVenue = searchParams.get('venue') || '';
  const prefillGuard = searchParams.get('guard') || '';

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    venueCategory: prefillVenue,
    venueName: '',
    addressLine1: '',
    city: '',
    postcode: '',
    startDate: '',
    startTime: '',
    endTime: '',
    numberOfGuards: '1',
    requiredLicenseType: '',
    hourlyRate: '',
    jobDescription: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    bookingType: 'one_off_shift',
    numberOfDays: '1',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefilledGuard, setPrefilledGuard] = useState<{id: string, full_name: string, hourly_rate: number} | null>(null);
  const [promoData, setPromoData] = useState<any>(null);
  const [globalPromoCounts, setGlobalPromoCounts] = useState<any>(null);
  const [canPostJobs, setCanPostJobs] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [entitlementsChecked, setEntitlementsChecked] = useState(false);

  useEffect(() => {
    checkAuth();
    if (prefillGuard) fetchPrefilledGuard();
    fetchPromoStats();
  }, []);

  const fetchPromoStats = async () => {
    const { data } = await supabase.rpc('get_client_promo_stats');
    if (data) {
      setGlobalPromoCounts({
        founding: data.counts?.founding ?? 0,
        early: data.counts?.early ?? 0,
        launch: data.counts?.launch ?? 0,
        caps: data.caps ?? { tier1: 50, tier2: 250, tier3: 1000 },
        tier3WindowEnd: data.tier3_window_end,
      });
    }
  };

  const fetchPrefilledGuard = async () => {
    const { data } = await supabase
      .from('guards')
      .select('id, full_name, hourly_rate, licence_types')
      .eq('id', prefillGuard)
      .eq('accepts_direct_bookings', true)
      .maybeSingle();
    if (data) {
      setPrefilledGuard(data);
      setFormData(prev => ({
        ...prev,
        hourlyRate: String(data.hourly_rate || ''),
        requiredLicenseType: data.licence_types?.[0]?.toLowerCase().replace(/\s/g, '_') || '',
      }));
    }
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/client/register?redirect=/post-job');
      return;
    }
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, contact_name, email, phone, client_promo_tier, client_signup_number, client_promo_ends_at, client_lifetime_fee_discount, client_promo_jobs_remaining, founding_client_badge')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!clientData) {
      router.push('/client/register?redirect=/post-job');
      return;
    }
    setIsAuth(true);
    setClientId(clientData.id);
    setPromoData({
      clientTier: clientData.client_promo_tier,
      signupNumber: clientData.client_signup_number,
      promoEndsAt: clientData.client_promo_ends_at,
      lifetimeDiscount: clientData.client_lifetime_fee_discount,
      jobsRemaining: clientData.client_promo_jobs_remaining,
      foundingBadge: clientData.founding_client_badge,
    });
    setFormData(prev => ({
      ...prev,
      contactName: clientData.contact_name || '',
      contactEmail: clientData.email || '',
      contactPhone: clientData.phone || '',
    }));
    setLoading(false);
    const canPost = await hasFeature(user.id, 'client.post_jobs');
    setCanPostJobs(canPost);
    setEntitlementsChecked(true);
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      if (prev?.[field]) {
        return { ...prev, [field]: '' };
      }
      return prev;
    });
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!formData.venueCategory) e.venueCategory = 'Select a venue type';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!formData.venueName.trim()) e.venueName = 'Venue name is required';
    if (!formData.addressLine1.trim()) e.addressLine1 = 'Address is required';
    if (!formData.city.trim()) e.city = 'City is required';
    if (!formData.postcode.trim()) e.postcode = 'Postcode is required';
    if (!formData.startDate) e.startDate = 'Start date is required';
    if (!formData.startTime) e.startTime = 'Start time is required';
    if (!formData.endTime) e.endTime = 'End time is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: Record<string, string> = {};
    if (!formData.requiredLicenseType) e.requiredLicenseType = 'Select a licence type';
    if (!formData.hourlyRate) e.hourlyRate = 'Hourly rate is required';
    const rate = parseFloat(formData.hourlyRate);
    if (isNaN(rate) || rate < 10) e.hourlyRate = 'Minimum £10.00 per hour';
    if (!formData.jobDescription.trim()) e.jobDescription = 'Brief description is required';
    if (formData.jobDescription.length > 500) e.jobDescription = 'Max 500 characters';
    if (!formData.contactName.trim()) e.contactName = 'Contact name is required';
    if (!formData.contactPhone.trim()) e.contactPhone = 'Contact phone is required';
    if (!formData.contactEmail.trim()) e.contactEmail = 'Contact email is required';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.contactEmail && !emailRe.test(formData.contactEmail)) e.contactEmail = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => setStep(s => s - 1);

  const calculateEndDate = () => {
    if (!formData.startDate || !formData.numberOfDays) return null;
    const d = new Date(formData.startDate);
    d.setDate(d.getDate() + parseInt(formData.numberOfDays) - 1);
    return d.toISOString().split('T')[0];
  };

  const calculateHours = () => {
    const [sh, sm] = formData.startTime.split(':').map(Number);
    const [eh, em] = formData.endTime.split(':').map(Number);
    let hrs = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hrs <= 0) hrs += 24;
    return hrs;
  };

  const estimatedTotal = () => {
    const hrs = calculateHours();
    return (hrs * parseFloat(formData.hourlyRate || '0') * parseInt(formData.numberOfGuards) * parseInt(formData.numberOfDays)).toFixed(2);
  };

  const serviceFee = () => {
    const total = parseFloat(estimatedTotal());
    return (total * 0.15).toFixed(2);
  };

  const isPromoZeroFee = () => {
    if (!promoData) return false;
    const now = new Date();
    const promoEnds = promoData.promoEndsAt ? new Date(promoData.promoEndsAt) : null;
    const tier = promoData.clientTier;
    if (tier === 'launch_client' && promoData.jobsRemaining > 0) return true;
    if (promoEnds && now < promoEnds) return true;
    return false;
  };

  const isLifetimeDiscount = () => {
    if (!promoData) return false;
    const now = new Date();
    const promoEnds = promoData.promoEndsAt ? new Date(promoData.promoEndsAt) : null;
    const tier = promoData.clientTier;
    return tier === 'founding_client' && promoData.lifetimeDiscount && (promoEnds ? now >= promoEnds : true);
  };

  const promoFeePct = () => {
    if (isPromoZeroFee()) return 0;
    if (isLifetimeDiscount()) return 15 * (1 - (promoData.lifetimeDiscount || 0));
    return 15;
  };

  const promoServiceFee = () => {
    const total = parseFloat(estimatedTotal());
    return (total * (promoFeePct() / 100)).toFixed(2);
  };

  const handlePost = async () => {
    if (!isAuth || !clientId) return;
    if (!validateStep3()) return;
    setSubmitting(true);

    try {
      const endDate = calculateEndDate();
      const fullAddress = [formData.addressLine1, formData.city, formData.postcode, 'UK'].filter(Boolean).join(', ');
      const geo = await geocodeAddress(fullAddress);

      const { data: jobData, error } = await supabase
        .from('jobs')
        .insert({
          client_id: clientId,
          job_title: `${formData.venueName} — ${venueCategories.find(v => v.key === formData.venueCategory)?.label || 'Security Job'}`,
          venue_category: formData.venueCategory,
          venue_name: formData.venueName.trim(),
          venue_address_line1: formData.addressLine1.trim(),
          venue_city: formData.city.trim(),
          venue_postcode: formData.postcode.trim(),
          number_of_guards: parseInt(formData.numberOfGuards),
          start_date: formData.startDate,
          end_date: endDate,
          start_time: formData.startTime ? `${formData.startTime}:00` : null,
          end_time: formData.endTime ? `${formData.endTime}:00` : null,
          hourly_rate: parseFloat(formData.hourlyRate),
          required_license_type: formData.requiredLicenseType || null,
          required_licence_types: formData.requiredLicenseType && formData.requiredLicenseType !== 'any'
            ? [formData.requiredLicenseType]
            : null,
          booking_type: formData.bookingType,
          number_of_days: parseInt(formData.numberOfDays),
          job_description: formData.jobDescription.trim(),
          contact_name: formData.contactName.trim(),
          contact_phone: formData.contactPhone.trim(),
          contact_email: formData.contactEmail.trim(),
          status: 'open',
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          city: formData.city.trim(),
          postcode: formData.postcode.trim(),
          sia_licence_required: true,
          security_type: deriveSecurityType(formData.venueCategory, formData.requiredLicenseType),
          urgency: 'standard',
          is_featured: false,
          is_urgent: false,
        })
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!jobData) throw new Error('Job creation failed');

      setJobId(jobData.id);
      setSuccess(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-matching-guards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ jobId: jobData.id }),
          }).catch(() => {});
        }
      } catch {}
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to post job' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !entitlementsChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!canPostJobs) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
            <i className="ri-vip-crown-line text-3xl text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
          <p className="text-slate-400 mb-6">
            Your current subscription does not include job posting. Upgrade your QuickGuard plan to unlock this feature.
          </p>
          <Link
            href="/pricing"
            prefetch={false}
            className="inline-block bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  if (success && jobId) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-8 text-center border border-[#1e2d4d]">
          <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-500/25">
            <i className="ri-checkbox-circle-line text-4xl text-emerald-400"></i>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Job Posted!</h2>
          <p className="text-slate-400 mb-6">Your security job is live. Matching guards in your area have been notified.</p>
          <div className="bg-[#162036] rounded-xl p-4 mb-6 text-left border border-[#1e2d4d]">
            <p className="text-sm text-slate-500 mb-1">Estimated cost</p>
            <p className="text-2xl font-bold text-teal-400">£{estimatedTotal()}</p>
            {isPromoZeroFee() ? (
              <p className="text-xs text-emerald-400 mt-1">QuickGuard fee: FREE (promo)</p>
            ) : isLifetimeDiscount() ? (
              <p className="text-xs text-amber-400 mt-1">QuickGuard fee: £{promoServiceFee()} ({promoFeePct().toFixed(1)}%)</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">+ £{serviceFee()} QuickGuard fee</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/client/jobs/${jobId}`} className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap text-center">
              View Job
            </Link>
            <Link href="/find-a-guard" className="bg-[#162036] text-slate-300 px-6 py-3 rounded-xl font-semibold hover:bg-[#1a2642] transition-colors border border-[#1e2d4d] whitespace-nowrap text-center">
              Browse Guards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Link href="/" className="text-slate-500 hover:text-white text-sm flex items-center gap-1 mb-4">
            <i className="ri-arrow-left-line"></i> Back to home
          </Link>
          <h1 className="text-3xl font-bold text-white mb-1">Post a Security Job</h1>
          <p className="text-slate-400">Hire SIA-licensed guards directly — no agency needed</p>
        </div>

        <PromoBanner
          clientTier={promoData?.clientTier}
          signupNumber={promoData?.signupNumber}
          promoEndsAt={promoData?.promoEndsAt}
          jobsRemaining={promoData?.jobsRemaining}
          lifetimeDiscount={promoData?.lifetimeDiscount}
          foundingBadge={promoData?.foundingBadge}
          globalCounts={globalPromoCounts}
        />

        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-500 border border-[#1e2d4d]'
              }`}>
                {step > s ? <i className="ri-check-line"></i> : s}
              </div>
              <div className={`h-1 flex-1 rounded-full ${step > s ? 'bg-teal-500' : 'bg-[#162036]'}`}></div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">What type of venue or event? *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {venueCategories.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => updateField('venueCategory', v.key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      formData.venueCategory === v.key
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-[#1e2d4d] bg-[#111d35] hover:border-teal-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-teal-400/20 bg-gradient-to-br ${v.color}`}>
                        <i className={`${v.icon} text-teal-400`}></i>
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${formData.venueCategory === v.key ? 'text-teal-300' : 'text-white'}`}>{v.label}</p>
                        <p className="text-xs text-slate-500">{v.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {errors?.venueCategory && <p className="text-red-400 text-sm mt-2">{errors.venueCategory}</p>}
            </div>
            <div className="flex justify-end">
              <button onClick={nextStep} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                Next: When &amp; Where <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Venue / Event Name *</label>
              <input type="text" value={formData.venueName} onChange={e => updateField('venueName', e.target.value)} placeholder="e.g. The Red Lion Pub" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
              {errors?.venueName && <p className="text-red-400 text-sm mt-1">{errors.venueName}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Address *</label>
              <input type="text" value={formData.addressLine1} onChange={e => updateField('addressLine1', e.target.value)} placeholder="Street address" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500 mb-2" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={formData.city} onChange={e => updateField('city', e.target.value)} placeholder="City" className="px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
                <input type="text" value={formData.postcode} onChange={e => updateField('postcode', e.target.value)} placeholder="Postcode" className="px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
              </div>
              {(errors?.addressLine1 || errors?.city || errors?.postcode) && (
                <p className="text-red-400 text-sm mt-1">{errors.addressLine1 || errors.city || errors.postcode}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date *</label>
                <input type="date" value={formData.startDate} onChange={e => updateField('startDate', e.target.value)} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm" />
                {errors?.startDate && <p className="text-red-400 text-sm mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Booking Type</label>
                <div className="relative">
                  <select value={formData.bookingType} onChange={e => updateField('bookingType', e.target.value)} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm pr-8 appearance-none">
                    {bookingTypes.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time *</label>
                <input type="time" value={formData.startTime} onChange={e => updateField('startTime', e.target.value)} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm" />
                {errors?.startTime && <p className="text-red-400 text-sm mt-1">{errors.startTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">End Time *</label>
                <input type="time" value={formData.endTime} onChange={e => updateField('endTime', e.target.value)} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm" />
                {errors?.endTime && <p className="text-red-400 text-sm mt-1">{errors.endTime}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Guards</label>
                <input type="number" value={formData.numberOfGuards} onChange={e => updateField('numberOfGuards', e.target.value)} min="1" max="50" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Days</label>
                <input type="number" value={formData.numberOfDays} onChange={e => updateField('numberOfDays', e.target.value)} min="1" max="90" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm" />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={prevStep} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button onClick={nextStep} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                Next: Requirements <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            {prefilledGuard && (
              <div className="bg-teal-500/10 border border-teal-400/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {prefilledGuard.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-300">Direct booking request for {prefilledGuard.full_name}</p>
                  <p className="text-xs text-slate-500">This guard will be notified first when you post this job</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Required SIA Licence *</label>
              <div className="grid grid-cols-1 gap-2">
                {licenceTypes.map(l => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => updateField('requiredLicenseType', l.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      formData.requiredLicenseType === l.value
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-[#1e2d4d] bg-[#111d35] hover:border-teal-500/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      formData.requiredLicenseType === l.value ? 'border-teal-500 bg-teal-500' : 'border-slate-600'
                    }`}>
                      {formData.requiredLicenseType === l.value && <i className="ri-check-line text-white text-xs"></i>}
                    </div>
                    <span className={`text-sm font-medium ${formData.requiredLicenseType === l.value ? 'text-teal-300' : 'text-white'}`}>{l.label}</span>
                  </button>
                ))}
              </div>
              {errors?.requiredLicenseType && <p className="text-red-400 text-sm mt-2">{errors.requiredLicenseType}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Your Budget (per guard, per hour) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">£</span>
                <input type="number" value={formData.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} min="10" step="0.50" placeholder="12.50" className="w-full pl-8 pr-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
              </div>
              {errors?.hourlyRate && <p className="text-red-400 text-sm mt-1">{errors.hourlyRate}</p>}
              <p className="text-xs text-slate-500 mt-1">Most guards charge £12–£18/hr. You choose the rate.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Brief Description * <span className="font-normal text-slate-500">({formData.jobDescription.length}/500)</span></label>
              <textarea value={formData.jobDescription} onChange={e => updateField('jobDescription', e.target.value)} maxLength={500} rows={4} placeholder="What does the guard need to do? e.g. Check IDs at the door, manage queue, handle disputes..." className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm resize-none placeholder:text-slate-500" />
              {errors?.jobDescription && <p className="text-red-400 text-sm mt-1">{errors.jobDescription}</p>}
            </div>

            <div className="border-t border-[#1e2d4d] pt-5">
              <h3 className="text-sm font-bold text-white mb-3">Your Contact Details</h3>
              <div className="space-y-3">
                <input type="text" value={formData.contactName} onChange={e => updateField('contactName', e.target.value)} placeholder="Your name" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="tel" value={formData.contactPhone} onChange={e => updateField('contactPhone', e.target.value)} placeholder="Phone number" className="px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
                  <input type="email" value={formData.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} placeholder="Email address" className="px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500" />
                </div>
                {(errors?.contactName || errors?.contactPhone || errors?.contactEmail) && (
                  <p className="text-red-400 text-sm">{errors.contactName || errors.contactPhone || errors.contactEmail}</p>
                )}
              </div>
            </div>

            {formData.hourlyRate && formData.startTime && formData.endTime && (
              <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                <h4 className="text-sm font-bold text-white mb-2">Cost Estimate</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400"><span>Rate</span><span>£{parseFloat(formData.hourlyRate).toFixed(2)}/hr</span></div>
                  <div className="flex justify-between text-slate-400"><span>Guards</span><span>× {formData.numberOfGuards}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Hours</span><span>× {calculateHours().toFixed(1)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Days</span><span>× {formData.numberOfDays}</span></div>
                  <div className="border-t border-[#1e2d4d] pt-1 flex justify-between">
                    <span className="font-semibold text-white">Subtotal</span>
                    <span className="font-bold text-teal-400">£{estimatedTotal()}</span>
                  </div>
                  {isPromoZeroFee() ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 line-through">QuickGuard service fee (15%)</span>
                      <span className="text-slate-500 line-through">£{serviceFee()}</span>
                    </div>
                  ) : isLifetimeDiscount() ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 line-through">QuickGuard service fee (15%)</span>
                        <span className="text-slate-500 line-through">£{serviceFee()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-400">QuickGuard service fee ({promoFeePct().toFixed(1)}%)</span>
                        <span className="font-semibold text-amber-400">£{promoServiceFee()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>QuickGuard service fee (15%)</span>
                      <span>£{serviceFee()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {errors?.submit && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-red-400 text-sm">
                <i className="ri-error-warning-line mr-1"></i>{errors.submit}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={prevStep} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button
                onClick={handlePost}
                disabled={submitting}
                className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Posting...</>
                ) : (
                  <><i className="ri-shield-check-line"></i>Post Job &amp; Notify Guards</>
                )}
              </button>
            </div>

            {!isAuth && (
              <p className="text-xs text-slate-500 text-center">
                You will be asked to create a free account before payment. No card required to post.
              </p>
            )}
          </div>
        )}
      </div>
      <UpgradeRequiredModal
        featureName="job posting"
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        audience="client"
      />
    </div>
  );
}