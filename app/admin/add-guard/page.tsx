'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BreadcrumbNav from './BreadcrumbNav';
import ImageUploadField from './ImageUploadField';
import DocumentUploadField from './DocumentUploadField';

interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  sia_licence_number: string;
  license_cardholder_name: string;
  sia_expiry_date: string;
  years_experience: string;
  hourly_rate: string;
  city: string;
  postcode: string;
  bio: string;
  available_days: string[];
  available_hours_from: string;
  available_hours_to: string;
  certifications: string[];
  licence_types: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CERT_OPTIONS = ['First Aid', 'Fire Safety', 'Conflict Management', 'CCTV Licence', 'Door Supervisor', 'Close Protection', 'Event Security', 'Retail Security'];
const LICENCE_TYPES = ['Door Supervisor', 'Security Guard', 'CCTV Operator', 'Close Protection', 'Key Holding', 'Cash & Valuables'];

const initialForm: FormData = {
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  date_of_birth: '',
  sia_licence_number: '',
  license_cardholder_name: '',
  sia_expiry_date: '',
  years_experience: '',
  hourly_rate: '',
  city: '',
  postcode: '',
  bio: '',
  available_days: [],
  available_hours_from: '',
  available_hours_to: '',
  certifications: [],
  licence_types: [],
};

const inputClasses = 'w-full px-4 py-2.5 bg-[#0a1628] border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm outline-none text-slate-200 placeholder:text-slate-600';
const labelClasses = 'block text-sm font-medium text-slate-300 mb-1.5';

function SectionHeader({ icon, label, accent }: { icon: string; label: string; accent: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${accent}-500/10`}>
        <i className={`${icon} text-${accent}-400`}></i>
      </div>
      {label}
    </h2>
  );
}

function ToggleChip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
        selected
          ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
          : 'bg-[#0a1628] border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-slate-300'
      }`}
    >
      {selected && <i className="ri-check-line mr-1"></i>}
      {label}
    </button>
  );
}

interface FileState {
  base64: string;
  name: string;
  type: string;
}

export default function AddGuardPage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ email: string } | null>(null);
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submittingRef = useRef(false);
  const [profileImage, setProfileImage] = useState<FileState | null>(null);
  const [siaFront, setSiaFront] = useState<FileState | null>(null);
  const [siaBack, setSiaBack] = useState<FileState | null>(null);
  const [siaSupporting, setSiaSupporting] = useState<FileState | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleMulti = (key: 'available_days' | 'certifications' | 'licence_types', value: string) => {
    setForm(prev => {
      const arr = prev[key];
      const exists = arr.includes(value);
      return { ...prev, [key]: exists ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const validateFileType = (file: FileState | null, allowed: string[], fieldName: string): boolean => {
    if (!file) return true;
    if (!allowed.includes(file.type)) {
      setFileErrors(prev => ({ ...prev, [fieldName]: 'Invalid file type' }));
      return false;
    }
    setFileErrors(prev => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');
    setSuccess(null);

    const allValid =
      validateFileType(profileImage, ['image/jpeg', 'image/png', 'image/webp'], 'profile') &&
      validateFileType(siaFront, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaFront') &&
      validateFileType(siaBack, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaBack') &&
      validateFileType(siaSupporting, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaSupporting');

    if (!allValid) return;

    submittingRef.current = true;
    setLoading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Please sign in again before creating a guard.');
      const payload: Record<string, unknown> = { ...form };
      if (profileImage) {
        payload.profile_image_base64 = profileImage.base64;
        payload.profile_image_name = profileImage.name;
      }
      if (siaFront) {
        payload.sia_front_base64 = siaFront.base64;
        payload.sia_front_name = siaFront.name;
      }
      if (siaBack) {
        payload.sia_back_base64 = siaBack.base64;
        payload.sia_back_name = siaBack.name;
      }
      if (siaSupporting) {
        payload.sia_supporting_base64 = siaSupporting.base64;
        payload.sia_supporting_name = siaSupporting.name;
      }

      const fingerprint = JSON.stringify(payload);
      if (submissionRef.current?.fingerprint !== fingerprint) {
        submissionRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      payload.idempotency_key = submissionRef.current.key;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-from-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify(payload),
        }
      );

      const result: unknown = await response.json();

      if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : `Failed to create guard (${response.status})`;
        throw new Error(message);
      }
      if (!('guardId' in result) || typeof result.guardId !== 'string' || !result.guardId
          || !('email' in result) || typeof result.email !== 'string'
          || result.email.toLowerCase() !== form.email.trim().toLowerCase()
          || !('status' in result) || result.status !== 'pending_review') {
        throw new Error('Guard creation could not be confirmed. Keep these details and check Guard Verifications before retrying.');
      }
      setSuccess({ email: result.email });
      submissionRef.current = null;
      setForm(initialForm);
      setProfileImage(null);
      setSiaFront(null);
      setSiaBack(null);
      setSiaSupporting(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create guard');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <BreadcrumbNav crumbs={[
        { label: 'Guards', href: '/admin/guard-verifications' },
        { label: 'Add Guard' },
      ]} />

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Add Guard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Create a guard account with profile image and SIA documents</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 flex items-center justify-center mt-0.5">
            <i className="ri-error-warning-line text-red-400"></i>
          </div>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center mt-0.5">
              <i className="ri-checkbox-circle-line text-emerald-400 text-xl"></i>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-300 mb-2">
                Guard Created — Pending Review
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono font-semibold text-slate-200">{success.email}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Link
                  href="/admin/guard-verifications"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-shield-check-line"></i>
                  Go to Guard Verifications
                </Link>
                <Link
                  href="/guard/login"
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2b4a] border border-[#1a2b4a] text-slate-300 rounded-lg font-medium hover:bg-[#243452] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-login-box-line"></i>
                  Guard Sign-In
                </Link>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Review the guard&apos;s details and documents in Guard Verifications before approving access. Account creation does not approve their SIA licence.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image Upload */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-camera-line" label="Profile Image" accent="pink" />
          <ImageUploadField
            label="Profile Photo"
            description="Upload a clear profile photo of the guard"
            recommendedSize="Square image, minimum 400x400 recommended"
            value={profileImage}
            onChange={(file) => {
              setProfileImage(file);
              if (file) validateFileType(file, ['image/jpeg', 'image/png', 'image/webp'], 'profile');
              else setFileErrors(prev => { const n = { ...prev }; delete n.profile; return n; });
            }}
            error={fileErrors.profile}
          />
        </div>

        {/* Personal Info */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-user-line" label="Personal Information" accent="blue" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClasses}>Email Address <span className="text-red-400">*</span></label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClasses} placeholder="guard@email.com" required />
            </div>
            <div>
              <label className={labelClasses}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClasses} placeholder="+44 7123 456789" />
            </div>
            <div>
              <label className={labelClasses}>First Name <span className="text-red-400">*</span></label>
              <input type="text" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} className={inputClasses} placeholder="John" required />
            </div>
            <div>
              <label className={labelClasses}>Last Name <span className="text-red-400">*</span></label>
              <input type="text" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} className={inputClasses} placeholder="Smith" required />
            </div>
            <div>
              <label className={labelClasses}>Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
            </div>
            <div>
              <label className={labelClasses}>City</label>
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} className={inputClasses} placeholder="London" />
            </div>
            <div>
              <label className={labelClasses}>Postcode</label>
              <input type="text" value={form.postcode} onChange={(e) => updateField('postcode', e.target.value)} className={inputClasses} placeholder="SW1A 1AA" />
            </div>
          </div>
        </div>

        {/* SIA Licence */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-shield-check-line" label="SIA Licence" accent="purple" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClasses}>SIA Licence Number <span className="text-red-400">*</span></label>
              <input type="text" value={form.sia_licence_number} onChange={(e) => updateField('sia_licence_number', e.target.value)} className={`${inputClasses} font-mono`} placeholder="1234-5678-9012-3456" required />
            </div>
            <div>
              <label className={labelClasses}>Cardholder Name</label>
              <input type="text" value={form.license_cardholder_name} onChange={(e) => updateField('license_cardholder_name', e.target.value)} className={inputClasses} placeholder="Name on the licence card" />
            </div>
            <div>
              <label className={labelClasses}>Expiry Date <span className="text-red-400">*</span></label>
              <input type="date" value={form.sia_expiry_date} onChange={(e) => updateField('sia_expiry_date', e.target.value)} className={`${inputClasses} [color-scheme:dark]`} required />
            </div>
            <div>
              <label className={labelClasses}>Years of Experience</label>
              <input type="number" value={form.years_experience} onChange={(e) => updateField('years_experience', e.target.value)} className={inputClasses} placeholder="5" min="0" />
            </div>
            <div>
              <label className={labelClasses}>Hourly Rate (&pound;)</label>
              <input type="number" value={form.hourly_rate} onChange={(e) => updateField('hourly_rate', e.target.value)} className={inputClasses} placeholder="20" min="0" step="0.01" />
            </div>
          </div>

          <div className="mt-5">
            <label className={labelClasses}>Licence Types</label>
            <div className="flex flex-wrap gap-2">
              {LICENCE_TYPES.map(type => (
                <ToggleChip key={type} selected={form.licence_types.includes(type)} onClick={() => toggleMulti('licence_types', type)} label={type} />
              ))}
            </div>
          </div>
        </div>

        {/* SIA Document Uploads */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-file-shield-2-line" label="SIA Documents" accent="amber" />
          <p className="text-sm text-slate-400 -mt-3 mb-5">Upload scanned copies of the SIA licence for verification. These are stored securely and never publicly accessible.</p>
          <div className="space-y-5">
            <DocumentUploadField
              label="SIA Licence Front"
              description="Front side of the SIA licence card"
              value={siaFront}
              onChange={(file) => {
                setSiaFront(file);
                if (file) validateFileType(file, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaFront');
                else setFileErrors(prev => { const n = { ...prev }; delete n.siaFront; return n; });
              }}
              error={fileErrors.siaFront}
            />
            <DocumentUploadField
              label="SIA Licence Back"
              description="Back side of the SIA licence card (optional)"
              value={siaBack}
              onChange={(file) => {
                setSiaBack(file);
                if (file) validateFileType(file, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaBack');
                else setFileErrors(prev => { const n = { ...prev }; delete n.siaBack; return n; });
              }}
              error={fileErrors.siaBack}
            />
            <DocumentUploadField
              label="Supporting Document"
              description="Any additional verification document (optional)"
              value={siaSupporting}
              onChange={(file) => {
                setSiaSupporting(file);
                if (file) validateFileType(file, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 'siaSupporting');
                else setFileErrors(prev => { const n = { ...prev }; delete n.siaSupporting; return n; });
              }}
              error={fileErrors.siaSupporting}
            />
          </div>
        </div>

        {/* Availability */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-calendar-check-line" label="Availability" accent="emerald" />
          <div className="mb-4">
            <label className={labelClasses}>Available Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <ToggleChip key={day} selected={form.available_days.includes(day)} onClick={() => toggleMulti('available_days', day)} label={day} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClasses}>Available From</label>
              <input type="time" value={form.available_hours_from} onChange={(e) => updateField('available_hours_from', e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
            </div>
            <div>
              <label className={labelClasses}>Available To</label>
              <input type="time" value={form.available_hours_to} onChange={(e) => updateField('available_hours_to', e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
            </div>
          </div>
        </div>

        {/* Certifications & Bio */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <SectionHeader icon="ri-briefcase-line" label="Professional Details" accent="indigo" />
          <div className="mb-4">
            <label className={labelClasses}>Certifications</label>
            <div className="flex flex-wrap gap-2">
              {CERT_OPTIONS.map(cert => (
                <ToggleChip key={cert} selected={form.certifications.includes(cert)} onClick={() => toggleMulti('certifications', cert)} label={cert} />
              ))}
            </div>
          </div>
          <div>
            <label className={labelClasses}>Bio</label>
            <textarea value={form.bio} onChange={(e) => updateField('bio', e.target.value)} className={`${inputClasses} resize-none min-h-[100px]`} placeholder="Brief description about the guard..." maxLength={500} />
            <p className="text-xs text-slate-500 text-right mt-1">{form.bio.length}/500</p>
          </div>
        </div>

        {/* Creation always requires a separate verification decision. */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <i className="ri-flashlight-line text-amber-400"></i>
              </div>
              <div>
                <h3 className="font-semibold text-white">Pending Review</h3>
                <p className="text-sm text-slate-400">New guards require verification before they can accept jobs.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pb-8">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Guard...
              </>
            ) : (
              <>
                <i className="ri-user-add-line"></i>
                Create Guard Account
              </>
            )}
          </button>
          <Link
            href="/admin/guard-verifications"
            className="px-6 py-3 bg-[#1a2b4a] text-slate-300 rounded-xl font-semibold hover:bg-[#243452] transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
