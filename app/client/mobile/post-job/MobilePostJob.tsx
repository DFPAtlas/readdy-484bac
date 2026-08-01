'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocoding';

const venueCategories = [
  { key: 'door_supervisor', label: 'Door Supervisor', icon: 'ri-door-open-line', desc: 'Nightclubs, bars, pubs' },
  { key: 'event_security', label: 'Event Security', icon: 'ri-calendar-event-line', desc: 'Festivals, concerts, parties' },
  { key: 'retail_security', label: 'Retail Security', icon: 'ri-store-2-line', desc: 'Shops, malls, loss prevention' },
  { key: 'security_guard', label: 'Security Guard', icon: 'ri-shield-check-line', desc: 'Sites, patrols, static posts' },
  { key: 'close_protection', label: 'Close Protection', icon: 'ri-shield-user-line', desc: 'Personal, VIP, escort' },
  { key: 'cctv_operator', label: 'CCTV Operator', icon: 'ri-camera-line', desc: 'Control room, monitoring' },
  { key: 'mobile_patrol', label: 'Mobile Patrol', icon: 'ri-car-line', desc: 'Car patrol, key holding' },
  { key: 'dog_handler', label: 'Dog Handler', icon: 'ri-bear-smile-line', desc: 'Search, detection, patrol' },
];

const licenceTypes = [
  { value: 'any', label: 'Any SIA Licence' },
  { value: 'door_supervisor', label: 'Door Supervisor' },
  { value: 'security_guard', label: 'Security Guard' },
  { value: 'cctv', label: 'CCTV Operator' },
  { value: 'close_protection', label: 'Close Protection' },
  { value: 'dog_handler', label: 'Dog Handler' },
];

const experienceLevels = [
  { value: 'entry', label: 'Entry (0-1 yrs)' },
  { value: 'intermediate', label: 'Intermediate (1-3 yrs)' },
  { value: 'experienced', label: 'Experienced (3-5 yrs)' },
  { value: 'senior', label: 'Senior (5+ yrs)' },
];

interface FormData {
  jobTitle: string;
  securityType: string;
  startDate: string;
  startTime: string;
  endTime: string;
  numberOfGuards: string;
  numberOfDays: string;
  urgency: string;
  siaLicenceRequired: string;
  specificLicences: string[];
  experienceLevel: string;
  uniformRequired: string;
  uniformDetails: string;
  venue: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  jobDescription: string;
  specialInstructions: string;
  hourlyRate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const defaultForm: FormData = {
  jobTitle: '',
  securityType: '',
  startDate: '',
  startTime: '',
  endTime: '',
  numberOfGuards: '1',
  numberOfDays: '1',
  urgency: 'standard',
  siaLicenceRequired: 'yes',
  specificLicences: [],
  experienceLevel: '',
  uniformRequired: 'no',
  uniformDetails: '',
  venue: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postcode: '',
  jobDescription: '',
  specialInstructions: '',
  hourlyRate: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

export default function MobilePostJob() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({ ...defaultForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/client/login?redirect=/client/mobile/post-job');
        return;
      }
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, contact_name, email, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      setClientId(clientData.id);
      setFormData(prev => ({
        ...prev,
        contactName: clientData.contact_name || '',
        contactEmail: clientData.email || '',
        contactPhone: clientData.phone || '',
      }));
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleLicence = (licence: string) => {
    setFormData(prev => ({
      ...prev,
      specificLicences: prev.specificLicences.includes(licence)
        ? prev.specificLicences.filter(l => l !== licence)
        : [...prev.specificLicences, licence],
    }));
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!formData.jobTitle.trim()) e.jobTitle = 'Job title is required';
    if (!formData.securityType) e.securityType = 'Select a security type';
    if (!formData.startDate) e.startDate = 'Start date is required';
    if (!formData.startTime) e.startTime = 'Start time is required';
    if (!formData.endTime) e.endTime = 'End time is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!formData.venue.trim()) e.venue = 'Venue name is required';
    if (!formData.addressLine1.trim()) e.addressLine1 = 'Address is required';
    if (!formData.city.trim()) e.city = 'City is required';
    if (!formData.postcode.trim()) e.postcode = 'Postcode is required';
    if (!formData.experienceLevel) e.experienceLevel = 'Select experience level';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: Record<string, string> = {};
    if (!formData.jobDescription.trim()) e.jobDescription = 'Description is required';
    if (formData.jobDescription.length > 500) e.jobDescription = 'Max 500 characters';
    if (!formData.hourlyRate) e.hourlyRate = 'Hourly rate is required';
    const rate = parseFloat(formData.hourlyRate);
    if (isNaN(rate) || rate < 10) e.hourlyRate = 'Minimum £10.00';
    if (!formData.contactName.trim()) e.contactName = 'Contact name is required';
    if (!formData.contactPhone.trim()) e.contactPhone = 'Phone is required';
    if (!formData.contactEmail.trim()) e.contactEmail = 'Email is required';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.contactEmail && !emailRe.test(formData.contactEmail)) e.contactEmail = 'Invalid email';
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
    return (parseFloat(estimatedTotal()) * 0.15).toFixed(2);
  };

  const handlePost = async () => {
    if (!validateStep3()) return;
    setSubmitting(true);
    try {
      const endDate = calculateEndDate();
      const fullAddress = [formData.addressLine1, formData.city, formData.postcode, 'UK'].filter(Boolean).join(', ');
      const geo = await geocodeAddress(fullAddress);

      const formatTime = (time: string) => {
        if (!time) return null;
        const trimmed = time.trim();
        return trimmed.split(':').length === 2 ? `${trimmed}:00` : trimmed;
      };

      const { data: jobData, error } = await supabase
        .from('jobs')
        .insert({
          client_id: clientId,
          job_title: formData.jobTitle.trim(),
          security_type: formData.securityType,
          job_description: formData.jobDescription.trim(),
          venue_name: formData.venue.trim(),
          venue_address_line1: formData.addressLine1.trim(),
          venue_address_line2: formData.addressLine2.trim() || null,
          venue_city: formData.city.trim(),
          venue_postcode: formData.postcode.trim(),
          number_of_guards: parseInt(formData.numberOfGuards),
          number_of_days: parseInt(formData.numberOfDays),
          start_date: formData.startDate,
          end_date: endDate,
          start_time: formatTime(formData.startTime),
          end_time: formatTime(formData.endTime),
          hourly_rate: parseFloat(formData.hourlyRate),
          sia_licence_required: formData.siaLicenceRequired === 'yes',
          required_licence_types: formData.specificLicences.length > 0 ? formData.specificLicences : null,
          uniform_required: formData.uniformRequired === 'yes',
          uniform_details: formData.uniformDetails.trim() || null,
          experience_level: formData.experienceLevel,
          special_instructions: formData.specialInstructions.trim() || null,
          urgency: formData.urgency,
          contact_name: formData.contactName.trim(),
          contact_phone: formData.contactPhone.trim(),
          contact_email: formData.contactEmail.trim(),
          status: 'open',
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (success && jobId) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="bg-[#111d35] rounded-2xl w-full max-w-sm p-6 text-center border border-[#1e2d4d]">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/25">
            <i className="ri-checkbox-circle-line text-3xl text-emerald-400"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Job Posted!</h2>
          <p className="text-slate-400 text-sm mb-4">Your job is live. Matching guards have been notified.</p>
          <div className="bg-[#162036] rounded-xl p-4 mb-5 text-left border border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Estimated cost</p>
            <p className="text-xl font-bold text-teal-400">£{estimatedTotal()}</p>
            <p className="text-xs text-slate-500 mt-1">+ £{serviceFee()} QuickGuard fee</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href={`/client/jobs/${jobId}`} className="bg-teal-500 text-white py-3 rounded-xl font-semibold text-center text-sm whitespace-nowrap">
              View Job
            </Link>
            <Link href="/client/mobile" className="bg-[#162036] text-slate-300 py-3 rounded-xl font-semibold text-center text-sm whitespace-nowrap border border-[#1e2d4d]">
              Back to Mobile Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] pb-28">
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-[#111d35] text-white px-4 py-3 rounded-xl shadow-lg border border-[#1e2d4d] flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-teal-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-4 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/client/mobile" className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center cursor-pointer">
            <i className="ri-arrow-left-line text-white text-sm"></i>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest text-teal-300">Client Portal</span>
        </div>
        <h1 className="text-white font-bold text-xl">Post a Security Job</h1>
        <p className="text-teal-200/70 text-sm mt-1">Hire SIA-licensed guards in minutes</p>
      </div>

      {/* Step indicator */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-500 border border-[#1e2d4d]'
              }`}>
                {step > s ? <i className="ri-check-line"></i> : s}
              </div>
              {s < 3 && (
                <div className={`h-1 flex-1 rounded-full ${step > s ? 'bg-teal-500' : 'bg-[#162036]'}`}></div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Step {step} of 3 — {step === 1 ? 'Job Details' : step === 2 ? 'Location & Requirements' : 'Pay & Contact'}
        </p>
      </div>

      {/* Form */}
      <div className="px-4 space-y-5">
        {/* Step 1: Job Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Job Title *</label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={e => updateField('jobTitle', e.target.value)}
                placeholder="e.g., Door Supervisor for Nightclub"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.jobTitle && <p className="text-red-400 text-xs mt-1">{errors.jobTitle}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Security Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {venueCategories.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => updateField('securityType', v.key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      formData.securityType === v.key
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-[#1e2d4d] bg-[#111d35] hover:border-teal-500/30'
                    }`}
                  >
                    <i className={`${v.icon} text-teal-400 text-sm mb-1 block`}></i>
                    <p className={`text-xs font-semibold ${formData.securityType === v.key ? 'text-teal-300' : 'text-white'}`}>{v.label}</p>
                    <p className="text-[10px] text-slate-500">{v.desc}</p>
                  </button>
                ))}
              </div>
              {errors.securityType && <p className="text-red-400 text-xs mt-1">{errors.securityType}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => updateField('startDate', e.target.value)}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Days</label>
                <div className="relative">
                  <select
                    value={formData.numberOfDays}
                    onChange={e => updateField('numberOfDays', e.target.value)}
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {[1,2,3,4,5,6,7,14,30,60,90].map(d => (
                      <option key={d} value={d}>{d} {d === 1 ? 'Day' : 'Days'}</option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time *</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={e => updateField('startTime', e.target.value)}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.startTime && <p className="text-red-400 text-xs mt-1">{errors.startTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">End Time *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={e => updateField('endTime', e.target.value)}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.endTime && <p className="text-red-400 text-xs mt-1">{errors.endTime}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Guards</label>
                <input
                  type="number"
                  value={formData.numberOfGuards}
                  onChange={e => updateField('numberOfGuards', e.target.value)}
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Urgency</label>
                <div className="relative">
                  <select
                    value={formData.urgency}
                    onChange={e => updateField('urgency', e.target.value)}
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="urgent">Urgent</option>
                    <option value="immediate">Immediate</option>
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={nextStep}
                className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                Next: Location <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Location & Requirements */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Venue Name *</label>
              <input
                type="text"
                value={formData.venue}
                onChange={e => updateField('venue', e.target.value)}
                placeholder="e.g., The Grand Hotel"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.venue && <p className="text-red-400 text-xs mt-1">{errors.venue}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 1 *</label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={e => updateField('addressLine1', e.target.value)}
                placeholder="Street address"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.addressLine1 && <p className="text-red-400 text-xs mt-1">{errors.addressLine1}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 2</label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={e => updateField('addressLine2', e.target.value)}
                placeholder="Apt, suite, etc. (optional)"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => updateField('city', e.target.value)}
                  placeholder="e.g., London"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Postcode *</label>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={e => updateField('postcode', e.target.value)}
                  placeholder="SW1A 1AA"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.postcode && <p className="text-red-400 text-xs mt-1">{errors.postcode}</p>}
              </div>
            </div>

            <div className="border-t border-[#1e2d4d] pt-4">
              <p className="text-sm font-semibold text-white mb-3">SIA Licence</p>
              <div className="flex gap-4 mb-3">
                {['yes', 'no'].map(val => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.siaLicenceRequired === val}
                      onChange={() => updateField('siaLicenceRequired', val)}
                      className="w-4 h-4 accent-teal-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">{val}</span>
                  </label>
                ))}
              </div>
              {formData.siaLicenceRequired === 'yes' && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {licenceTypes.map(l => (
                    <label key={l.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-[#1e2d4d] bg-[#162036]">
                      <input
                        type="checkbox"
                        checked={formData.specificLicences.includes(l.value)}
                        onChange={() => toggleLicence(l.value)}
                        className="w-4 h-4 accent-teal-500 rounded"
                      />
                      <span className="text-xs text-slate-300">{l.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Experience Level *</label>
              <div className="relative">
                <select
                  value={formData.experienceLevel}
                  onChange={e => updateField('experienceLevel', e.target.value)}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select level</option>
                  {experienceLevels.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
              </div>
              {errors.experienceLevel && <p className="text-red-400 text-xs mt-1">{errors.experienceLevel}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Uniform Required</label>
              <div className="flex gap-4 mb-2">
                {['yes', 'no'].map(val => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.uniformRequired === val}
                      onChange={() => updateField('uniformRequired', val)}
                      className="w-4 h-4 accent-teal-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">{val}</span>
                  </label>
                ))}
              </div>
              {formData.uniformRequired === 'yes' && (
                <input
                  type="text"
                  value={formData.uniformDetails}
                  onChange={e => updateField('uniformDetails', e.target.value)}
                  placeholder="Describe uniform requirements"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={prevStep}
                className="text-slate-400 hover:text-white font-semibold text-sm cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button
                onClick={nextStep}
                className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                Next: Pay & Contact <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pay & Contact */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Hourly Rate (£) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">£</span>
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={e => updateField('hourlyRate', e.target.value)}
                  min="10"
                  step="0.50"
                  placeholder="12.50"
                  className="w-full pl-8 pr-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              {errors.hourlyRate && <p className="text-red-400 text-xs mt-1">{errors.hourlyRate}</p>}
              <p className="text-xs text-slate-500 mt-1">Most guards charge £12–£18/hr</p>
            </div>

            {formData.hourlyRate && formData.startTime && formData.endTime && (
              <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                <p className="text-xs font-semibold text-white mb-2">Cost Estimate</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400"><span>Rate</span><span>£{parseFloat(formData.hourlyRate).toFixed(2)}/hr</span></div>
                  <div className="flex justify-between text-slate-400"><span>Hours</span><span>× {calculateHours().toFixed(1)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Guards</span><span>× {formData.numberOfGuards}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Days</span><span>× {formData.numberOfDays}</span></div>
                  <div className="border-t border-[#1e2d4d] pt-1 flex justify-between">
                    <span className="font-semibold text-white">Subtotal</span>
                    <span className="font-bold text-teal-400">£{estimatedTotal()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>QuickGuard fee (15%)</span>
                    <span>£{serviceFee()}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Job Description *</label>
              <textarea
                value={formData.jobDescription}
                onChange={e => updateField('jobDescription', e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="What does the guard need to do?"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <div className="flex justify-between mt-1">
                {errors.jobDescription && <p className="text-red-400 text-xs">{errors.jobDescription}</p>}
                <p className="text-xs text-slate-500 ml-auto">{formData.jobDescription.length}/500</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Special Instructions</label>
              <textarea
                value={formData.specialInstructions}
                onChange={e => updateField('specialInstructions', e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Parking, check-in, access codes..."
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1 text-right">{formData.specialInstructions.length}/500</p>
            </div>

            <div className="border-t border-[#1e2d4d] pt-4">
              <p className="text-sm font-semibold text-white mb-3">Your Contact</p>
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={e => updateField('contactName', e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {errors.contactName && <p className="text-red-400 text-xs mt-1">{errors.contactName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={e => updateField('contactPhone', e.target.value)}
                      placeholder="Phone"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {errors.contactPhone && <p className="text-red-400 text-xs mt-1">{errors.contactPhone}</p>}
                  </div>
                  <div>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={e => updateField('contactEmail', e.target.value)}
                      placeholder="Email"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {errors.contactEmail && <p className="text-red-400 text-xs mt-1">{errors.contactEmail}</p>}
                  </div>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{errors.submit}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={prevStep}
                className="text-slate-400 hover:text-white font-semibold text-sm cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button
                onClick={handlePost}
                disabled={submitting}
                className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Posting...</>
                ) : (
                  <><i className="ri-shield-check-line"></i>Post Job</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}