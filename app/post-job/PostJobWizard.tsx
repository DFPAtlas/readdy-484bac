'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { sanitizeRedirectPath } from '@/lib/safe-redirect';
import {
  buildPendingJobDraft,
  savePendingJobDraft,
  loadPendingJobDraft,
  clearPendingJobDraft,
  IMMEDIATE_BOOKING_RETURN_PATH,
} from '@/lib/pending-job-draft';
import { londonCalendarDate } from '@/lib/date-only';
import { availabilityInput } from '@/lib/guest-booking-policy';
import { checkGuestAvailability,guestBookingRequest,readEnquiryReceipt,rememberEnquiryReceipt,createEnquiryReceipt,withdrawGuestEnquiry,BOOKING_FOLLOWUP_TEXT,BOOKING_FOLLOWUP_VERSION,type GuestAvailability } from '@/lib/guest-booking';
import BookingAuthModal from './BookingAuthModal';
import PostJobBackdrop from './PostJobBackdrop';
import PostJobProgress from './PostJobProgress';
import VenueCard from './VenueCard';
import styles from './postJobInputs.module.css';

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
  const sourceParam = (searchParams.get('source') || 'post-job').slice(0,200);

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
  const [loading, setLoading] = useState(true);
  const [prefilledGuard, setPrefilledGuard] = useState<{ id: string; full_name: string; hourly_rate: number } | null>(null);
  const [showAuthChoice, setShowAuthChoice] = useState(false);

  const [minDate, setMinDate] = useState('');
  const [entryChoice,setEntryChoice] = useState(false);
  const [availability,setAvailability] = useState<GuestAvailability|null>(null);
  const [checkingAvailability,setCheckingAvailability] = useState(false);
  const [followupConsent,setFollowupConsent] = useState(false);
  const [savingEnquiry,setSavingEnquiry] = useState(false);
  const [hasEnquiry,setHasEnquiry] = useState(false);
  const [enquiryMessage,setEnquiryMessage] = useState('');
  const [accountError,setAccountError] = useState('');
  const requestEpoch=useRef(0);
  const mounted=useRef(true);
  const submissionId=useRef('');

  useEffect(() => {
    mounted.current=true;
    ++requestEpoch.current;
    let active=true;
    const draft=loadPendingJobDraft();
    if(draft){submissionId.current=draft.submissionId;setFormData(previous=>({...previous,...Object.fromEntries(Object.keys(previous).map(key=>[key,draft[key as keyof typeof draft] || previous[key as keyof FormData]]))}));}
    setHasEnquiry(!!readEnquiryReceipt());
    setMinDate(londonCalendarDate());
    async function load(){
      try{
        const session=await supabase.auth.getSession();if(session.error)throw session.error;
        const verified=session.data.session?await supabase.auth.getUser():{data:{user:null},error:null};if(verified.error)throw verified.error;const user=verified.data.user;
        if(!active||!mounted.current)return;
        if(user){
          const result=await supabase.from('clients').select('id,contact_name,email,phone,is_active').eq('user_id',user.id).maybeSingle();
          if(result.error)throw result.error;
          if(!active||!mounted.current)return;
          const client=result.data;
          if(client?.is_active===true){setIsAuth(true);setClientId(client.id);setEntryChoice(true);setFormData(previous=>({...previous,contactName:previous.contactName||client.contact_name||'',contactEmail:previous.contactEmail||client.email||'',contactPhone:previous.contactPhone||client.phone||''}));}
          else setAccountError('Booking requires an active client account. Use a client account to continue.');
        }
        if(prefillGuard){
          const {data}=await supabase.from('guards').select('id,full_name,hourly_rate,licence_types').eq('id',prefillGuard).eq('accepts_direct_bookings',true).maybeSingle();
          if(data&&active&&mounted.current){setPrefilledGuard({id:data.id,full_name:data.full_name,hourly_rate:data.hourly_rate});setFormData(previous=>({...previous,hourlyRate:String(data.hourly_rate||''),requiredLicenseType:data.licence_types?.[0]?.toLowerCase().replace(/\s/g,'_')||''}));}
        }
      }catch{if(active&&mounted.current)setAccountError('Account status could not be checked. You can check availability and sign in again before booking.');}
      finally{if(active&&mounted.current)setLoading(false);}
    }
    void load();
    return()=>{active=false;mounted.current=false;};
  },[prefillGuard]);

  const updateField = (field: keyof FormData, value: string) => {
    ++requestEpoch.current;setAvailability(null);setCheckingAvailability(false);setEnquiryMessage('');
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
    else if (minDate && formData.startDate < minDate) e.startDate = 'Start date cannot be in the past';
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

  const getSafeReturnPath = () =>
    sanitizeRedirectPath(IMMEDIATE_BOOKING_RETURN_PATH, 'client', '/client/dashboard');

  const saveDraft = () => {
    const draft=buildPendingJobDraft({mode:'immediate',source:sourceParam,...formData,submissionId:submissionId.current||undefined});
    submissionId.current=draft.submissionId;
    if(!savePendingJobDraft(draft)){setErrors(previous=>({...previous,submit:'Your browser could not save this booking. Allow site storage and retry before continuing to signup.'}));return false;}
    return true;
  };

  const checkAvailability=async()=>{
    if(!validateStep1()){setStep(1);return;}if(!validateStep2()){setStep(2);return;}if(!validateStep3())return;
    try{availabilityInput({...formData});}catch(error){setErrors({submit:error instanceof Error?error.message:'Check the booking details.'});return;}
    if(!saveDraft())return;
    const epoch=++requestEpoch.current;setCheckingAvailability(true);setAvailability(null);
    try{const result=await checkGuestAvailability({...formData});if(mounted.current&&epoch===requestEpoch.current)setAvailability(result);}
    catch(error){if(mounted.current&&epoch===requestEpoch.current)setErrors({submit:error instanceof Error?error.message:'Availability could not be checked. Please retry.'});}
    finally{if(mounted.current&&epoch===requestEpoch.current)setCheckingAvailability(false);}
  };

  const saveEnquiry=async()=>{
    if(!followupConsent||!availability)return;
    if(!formData.contactName.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)){setEnquiryMessage('Add your name and a valid email above to save booking follow-up.');return;}
    if(!saveDraft())return;
    setSavingEnquiry(true);setEnquiryMessage('');
    try{
      const old=readEnquiryReceipt();
      if(old&&old.submissionId!==submissionId.current)throw new Error('Remove the previous saved enquiry before saving new details.');
      const receipt=old||createEnquiryReceipt(submissionId.current);
      if(!rememberEnquiryReceipt(receipt))throw new Error('Allow site storage to keep your enquiry removal receipt.');
      setHasEnquiry(true);
      const result=await guestBookingRequest({action:'save_enquiry',receipt:receipt.token,submissionId:submissionId.current,email:formData.contactEmail,contactName:formData.contactName,postcodeArea:formData.postcode.replace(/\s/g,'').slice(0,-3),startDate:formData.startDate,followupConsent:true,consentVersion:BOOKING_FOLLOWUP_VERSION});
      if(typeof result.expiresAt!=='string'||!result.saved)throw new Error('Enquiry confirmation is pending. Retry to check it.');
      if(readEnquiryReceipt()?.token===receipt.token)rememberEnquiryReceipt({...receipt,expiresAt:result.expiresAt});
      if(mounted.current)setEnquiryMessage('Booking follow-up saved. You can remove it below.');
    }catch(error){if(mounted.current)setEnquiryMessage(error instanceof Error?error.message:'Follow-up could not be saved. Retry or remove the saved enquiry.');}
    finally{if(mounted.current)setSavingEnquiry(false);}
  };
  const removeEnquiry=async()=>{setSavingEnquiry(true);try{await withdrawGuestEnquiry();if(mounted.current){setHasEnquiry(false);setFollowupConsent(false);setEnquiryMessage('Saved booking follow-up removed.');}}catch{if(mounted.current)setEnquiryMessage('Removal could not be confirmed. Please retry.');}finally{if(mounted.current)setSavingEnquiry(false);}};

  const handleContinue = () => {
    if(!availability||Date.now()-Date.parse(availability.checkedAt)>300000){setAvailability(null);setErrors({submit:'Check availability again before continuing.'});return;}
    if (!validateStep3()||!saveDraft()) return;
    const safeReturn=getSafeReturnPath();
    if(isAuth&&clientId){router.push(safeReturn);return;}
    try{sessionStorage.setItem('post_auth_redirect',safeReturn);}catch{}
    setShowAuthChoice(true);
  };

  const goToRegister = () => {
    const safeReturn = getSafeReturnPath();
    router.push(`/client/register?redirect=${encodeURIComponent(safeReturn)}`);
  };

  const goToLogin = () => {
    const safeReturn = getSafeReturnPath();
    router.push(`/client/login?redirect=${encodeURIComponent(safeReturn)}`);
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0B1933]">
        <PostJobBackdrop />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div
            role="status"
            aria-label="Loading booking form"
            className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin"
          ></div>
        </div>
      </div>
    );
  }

  if(!entryChoice)return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0B1933]">
      <PostJobBackdrop />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-14 sm:px-6 sm:py-20">
        <section className="w-full min-w-0 rounded-3xl border border-white/10 bg-[#0A1730]/95 p-6 text-slate-200 shadow-2xl ring-1 ring-inset ring-white/5 sm:p-9">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200">
            <i className="ri-shield-check-line" aria-hidden="true"></i>
            Book a Guard Now
          </span>
          <h1 className="mb-4 text-2xl font-bold leading-tight text-white sm:text-3xl">Do you have a QuickGuard account?</h1>
          <p className="mb-6 text-slate-300">Sign in to book, or check matching guard availability before creating a free client account.</p>
          {accountError&&<p role="alert" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-200">{accountError}</p>}
          <div className="flex flex-col gap-4">
            <button type="button" onClick={goToLogin} className="w-full whitespace-nowrap rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]">Yes, sign in</button>
            <button type="button" onClick={()=>setEntryChoice(true)} className="w-full whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 font-semibold text-white hover:bg-white/[0.09] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]">No, check availability first</button>
            <Link href="/" className="text-center text-slate-300 underline hover:text-white">Back to home</Link>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0B1933]">
      <PostJobBackdrop />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 sm:mb-8">
          <Link href="/" className="mb-4 flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            <i className="ri-arrow-left-line" aria-hidden="true"></i> Back to home
          </Link>
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200">
            <i className="ri-flashlight-fill" aria-hidden="true"></i>
            Book a Guard Now
          </span>
          <h1 className="mb-2 text-2xl font-bold leading-tight text-white sm:text-3xl">Tell us what you need</h1>
          <p className="max-w-2xl text-sm text-slate-300 sm:text-base">Check which verified guards match your request before you sign in. Checking availability does not post a job and does not notify any guard — you review and confirm posting first, and no card details are taken until you select a guard and reach payment.</p>
        </div>

        <PostJobProgress step={step} />

        <div className="min-w-0 rounded-3xl border border-white/10 bg-[#0A1730]/95 p-5 shadow-2xl ring-1 ring-inset ring-white/5 sm:p-8">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">What type of venue or event? *</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {venueCategories.map(v => (
                  <VenueCard
                    key={v.key}
                    label={v.label}
                    desc={v.desc}
                    icon={v.icon}
                    selected={formData.venueCategory === v.key}
                    onSelect={() => updateField('venueCategory', v.key)}
                  />
                ))}
              </div>
              {errors?.venueCategory && <p className="text-red-300 text-sm mt-2">{errors.venueCategory}</p>}
            </div>
            <div className="flex justify-end">
              <button onClick={nextStep} className="shrink-0 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-500 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730] sm:px-8">
                Next: When &amp; Where <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Venue / Event Name *</label>
              <input disabled={savingEnquiry} type="text" aria-label="Venue or event name" value={formData.venueName} onChange={e => updateField('venueName', e.target.value)} placeholder="e.g. The Red Lion Pub" className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
              {errors?.venueName && <p className="text-red-300 text-sm mt-1">{errors.venueName}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Address *</label>
              <input disabled={savingEnquiry} type="text" aria-label="Street address" value={formData.addressLine1} onChange={e => updateField('addressLine1', e.target.value)} placeholder="Street address" className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400 mb-2" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input disabled={savingEnquiry} type="text" aria-label="City" value={formData.city} onChange={e => updateField('city', e.target.value)} placeholder="City" className="px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
                <input disabled={savingEnquiry} type="text" aria-label="Postcode" value={formData.postcode} onChange={e => updateField('postcode', e.target.value)} placeholder="Postcode" className="px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
              </div>
              {(errors?.addressLine1 || errors?.city || errors?.postcode) && (
                <p className="text-red-300 text-sm mt-1">{errors.addressLine1 || errors.city || errors.postcode}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date *</label>
                <input disabled={savingEnquiry} type="date" aria-label="Start date" value={formData.startDate} min={minDate || undefined} onChange={e => updateField('startDate', e.target.value)} className={`${styles.dateTimeInput} w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm`} />
                {errors?.startDate && <p className="text-red-300 text-sm mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Booking Type</label>
                <div className="relative">
                  <select disabled={savingEnquiry} value={formData.bookingType} onChange={e => updateField('bookingType', e.target.value)} className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm pr-8 appearance-none [&>option]:bg-[#0A1730] [&>option]:text-white">
                    {bookingTypes.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time *</label>
                <input disabled={savingEnquiry} type="time" aria-label="Start time" value={formData.startTime} onChange={e => updateField('startTime', e.target.value)} className={`${styles.dateTimeInput} w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm`} />
                {errors?.startTime && <p className="text-red-300 text-sm mt-1">{errors.startTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">End Time *</label>
                <input disabled={savingEnquiry} type="time" aria-label="End time" value={formData.endTime} onChange={e => updateField('endTime', e.target.value)} className={`${styles.dateTimeInput} w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm`} />
                {errors?.endTime && <p className="text-red-300 text-sm mt-1">{errors.endTime}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Guards</label>
                <input disabled={savingEnquiry} type="number" aria-label="Number of guards" value={formData.numberOfGuards} onChange={e => updateField('numberOfGuards', e.target.value)} min="1" max="50" className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Number of Days</label>
                <input disabled={savingEnquiry} type="number" aria-label="Number of days" value={formData.numberOfDays} onChange={e => updateField('numberOfDays', e.target.value)} min="1" max="90" className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm" />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={prevStep} className="text-slate-300 hover:text-white font-semibold cursor-pointer whitespace-nowrap rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]">
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button onClick={nextStep} className="shrink-0 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-500 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730] sm:px-8">
                Next: Requirements <i className="ri-arrow-right-line ml-1"></i>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            {prefilledGuard && (
              <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {prefilledGuard.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-300">Rate reference: {prefilledGuard.full_name}</p>
                  <p className="text-xs text-slate-400">Availability below covers all matching guards. You choose a guard after reviewing applications.</p>
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
                    aria-pressed={formData.requiredLicenseType===l.value}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730] ${
                      formData.requiredLicenseType === l.value
                        ? 'border-red-400/70 bg-red-500/15'
                        : 'border-white/10 bg-white/[0.05] hover:border-red-400/40 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      formData.requiredLicenseType === l.value ? 'border-red-500 bg-red-500' : 'border-slate-600'
                    }`}>
                      {formData.requiredLicenseType === l.value && <i className="ri-check-line text-white text-xs"></i>}
                    </div>
                    <span className={`text-sm font-medium ${formData.requiredLicenseType === l.value ? 'text-red-300' : 'text-white'}`}>{l.label}</span>
                  </button>
                ))}
              </div>
              {errors?.requiredLicenseType && <p className="text-red-300 text-sm mt-2">{errors.requiredLicenseType}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Agreed guard pay (per guard, per hour) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                <input disabled={savingEnquiry} type="number" aria-label="Hourly rate" value={formData.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} min="10" step="0.50" placeholder="12.50" className="w-full pl-8 pr-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
              </div>
              {errors?.hourlyRate && <p className="text-red-300 text-sm mt-1">{errors.hourlyRate}</p>}
              <p className="text-xs text-slate-400 mt-1">You set the gross hourly pay offered to each guard. Minimum £10.00 per hour.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Brief Description * <span className="font-normal text-slate-400">({formData.jobDescription.length}/500)</span></label>
              <textarea disabled={savingEnquiry} aria-label="Brief description" value={formData.jobDescription} onChange={e => updateField('jobDescription', e.target.value)} maxLength={500} rows={4} placeholder="What does the guard need to do? e.g. Check IDs at the door, manage queue, handle disputes..." className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm resize-none placeholder:text-slate-400" />
              {errors?.jobDescription && <p className="text-red-300 text-sm mt-1">{errors.jobDescription}</p>}
            </div>

            <div className="border-t border-white/10 pt-5">
              <h3 className="text-sm font-bold text-white mb-3">Contact details (optional before booking)</h3>
              <div className="space-y-3">
                <input disabled={savingEnquiry} type="text" aria-label="Your name" value={formData.contactName} onChange={e => updateField('contactName', e.target.value)} placeholder="Your name" className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input disabled={savingEnquiry} type="tel" aria-label="Phone number" value={formData.contactPhone} onChange={e => updateField('contactPhone', e.target.value)} placeholder="Phone number" className="px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
                  <input disabled={savingEnquiry} type="email" aria-label="Email address" value={formData.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} placeholder="Email address" className="px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 text-white text-sm placeholder:text-slate-400" />
                </div>
                {(errors?.contactName || errors?.contactPhone || errors?.contactEmail) && (
                  <p className="text-red-300 text-sm">{errors.contactName || errors.contactPhone || errors.contactEmail}</p>
                )}
              </div>
            </div>

            {formData.hourlyRate && formData.startTime && formData.endTime && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <h4 className="text-sm font-bold text-white mb-2">Cost estimate — guard pay only</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400"><span>Agreed guard pay</span><span>£{parseFloat(formData.hourlyRate).toFixed(2)}/hr</span></div>
                  <div className="flex justify-between text-slate-400"><span>Guards</span><span>× {formData.numberOfGuards}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Hours</span><span>× {calculateHours().toFixed(1)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>Days</span><span>× {formData.numberOfDays}</span></div>
                  <div className="border-t border-white/10 pt-1 flex justify-between">
                    <span className="font-semibold text-white">Estimated gross guard pay</span>
                    <span className="font-bold text-red-400">£{estimatedTotal()}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">This estimate is the agreed gross pay for guards at the hourly rate you set. A separate booking fee is added on top and its percentage depends on your client plan; any client plan subscription is billed separately. The final amount, including the booking fee, is shown before payment.</p>
                  <p className="text-xs text-slate-400">Guards browse and apply free — there are no paid guard tiers, no application caps, and no booking commission is deducted from the agreed guard pay.</p>
                </div>
              </div>
            )}

            {errors?.submit && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-red-300 text-sm">
                <i className="ri-error-warning-line mr-1"></i>{errors.submit}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={prevStep} className="text-slate-300 hover:text-white font-semibold cursor-pointer whitespace-nowrap rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]">
                <i className="ri-arrow-left-line mr-1"></i> Back
              </button>
              <button
                onClick={checkAvailability}
                disabled={checkingAvailability||savingEnquiry}
                className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-red-500 disabled:opacity-60 cursor-pointer whitespace-nowrap flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]"
              >
                <i className="ri-flashlight-fill"></i>
                {checkingAvailability?'Checking availability…':'Check matching guards'}
              </button>
            </div>
            {availability&&<section aria-labelledby="guest-availability-title" className="rounded-2xl border border-teal-400/30 bg-teal-500/10 p-5 space-y-4">
              <h2 id="guest-availability-title" className="text-xl font-bold text-white">{availability.count} {availability.count===1?'guard matches':'guards match'} your requirements</h2>
              <p className="text-sm text-slate-300">You requested {formData.numberOfGuards} {formData.numberOfGuards==='1'?'guard':'guards'}. {availability.count<Number(formData.numberOfGuards)?'Fewer guards match than you requested; full cover is not confirmed.':''}</p>
              <p className="text-sm text-slate-300">{availability.scope==='first_shift'?'For recurring or ongoing cover, this count covers your first requested shift only; later shifts are not included in this check.':`This count covers all ${availability.daysChecked} requested shift ${availability.daysChecked===1?'day':'days'}.`} The check uses recorded matching criteria only: required SIA licence, shift schedule, travel distance from your postcode, venue preferences, budget and existing assignments. Guards whose availability is not recorded are excluded.</p>
              <p className="text-sm text-slate-300">{availability.count===0?'No guards currently match these recorded criteria. You can adjust the request or create a free client account to post it.':'A match is not a reservation and no cover is guaranteed. Guards still decide whether to accept work.'} Sign in or create a free client account, review your request and confirm posting before any guard is notified. Selecting a guard is provisional, and cover is confirmed only after Stripe payment succeeds. {prefilledGuard?'This is the overall matching pool; a named guard request is checked separately.':''}</p>
              <button type="button" disabled={savingEnquiry} onClick={handleContinue} className="w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-60 cursor-pointer hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]">{isAuth?'Continue to review booking':'Continue with a client account'}</button>
              {!isAuth&&<div className="border-t border-slate-600 pt-4 space-y-3"><label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" checked={followupConsent} disabled={savingEnquiry} onChange={event=>setFollowupConsent(event.target.checked)} className="mt-1"/>{BOOKING_FOLLOWUP_TEXT}</label><p className="text-sm text-slate-400"><Link href="/privacy" className="underline">Privacy policy</Link>. This optional choice is separate from creating an account.</p><button type="button" disabled={!followupConsent||savingEnquiry} onClick={saveEnquiry} className="rounded-lg border border-slate-500 px-4 py-2 text-sm text-white disabled:opacity-50">{savingEnquiry?'Saving…':'Save booking follow-up'}</button></div>}
            </section>}
            <button type="button" disabled={savingEnquiry} onClick={()=>{clearPendingJobDraft();setEnquiryMessage('Saved draft removed from this browser.');}} className="text-sm text-slate-300 underline">Remove saved draft from this browser</button>
            {hasEnquiry&&<button type="button" disabled={savingEnquiry} onClick={removeEnquiry} className="text-sm text-slate-300 underline">Remove saved booking follow-up</button>}
            {enquiryMessage&&<p role="status" className="text-sm text-amber-200">{enquiryMessage}</p>}
            <p className="text-sm text-slate-400 text-center">Your saved draft can be restored in this browser for up to 24 hours. No job is posted and no guard is notified until you sign in, review the request and confirm posting. No card details are taken until you select a guard and reach payment.</p>
          </div>
        )}
        </div>
      </div>

      <BookingAuthModal
        isOpen={showAuthChoice}
        email={formData.contactEmail}
        onClose={() => setShowAuthChoice(false)}
        onRegister={goToRegister}
        onLogin={goToLogin}
      />
    </div>
  );
}