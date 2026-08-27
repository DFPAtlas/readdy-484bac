'use client';

import ChecklistProgress from '../guard-verifications/ChecklistProgress';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import SIALicenceImage from '@/components/SIALicenceImage';

interface Guard {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  sia_licence_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean | null;
  sia_verified_at: string | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  sia_licence_uploaded_at?: string | null;
  verification_status: string | null;
  verified_at: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  total_earnings: number | null;
  years_experience: number | null;
  hourly_rate: number | null;
  licence_types: string[] | null;
  certifications: string[] | null;
  profile_completed: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  willing_to_travel: boolean | null;
  has_transport: boolean | null;
  max_distance_miles: number | null;
  bank_account_verified: boolean | null;
  rejection_reason: string | null;
  notes?: string | null;
}

interface Props {
  guard: Guard;
  onClose: () => void;
  onUpdate: (guardId: string, updates: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  onAfterMutation: (guardId: string, updates: Record<string, any>) => void;
}

export default function GuardProfileDetailModal({ guard, onClose, onUpdate, onAfterMutation }: Props) {
  const [local, setLocal] = useState(guard);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(guard.notes || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'sia' | 'earnings' | 'reviews' | 'notes'>('overview');
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const initials = local.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (activeTab === 'reviews' && reviews.length === 0) fetchReviews();
    if (activeTab === 'earnings' && payouts.length === 0) fetchPayouts();
  }, [activeTab]);

  const fetchReviews = async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-guards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'get-reviews', guardId: local.id }),
        }
      );
      if (res.ok) {
        const result = await res.json();
        const reviewsArr = Array.isArray(result.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [];
        if (!Array.isArray(result.data) && !Array.isArray(result)) {
          console.warn('[GuardProfiles] Unexpected reviews response shape:', result);
        }
        setReviews(reviewsArr);
      } else {
        setReviewsError('Failed to load reviews');
      }
    } catch (err: any) {
      console.error('[GuardProfiles] Reviews fetch error:', err);
      setReviewsError(err?.message || 'Network error loading reviews');
    }
    setReviewsLoading(false);
  };

  const fetchPayouts = async () => {
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-guards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'get-payouts', guardId: local.id }),
        }
      );
      if (res.ok) {
        const result = await res.json();
        const payoutsArr = Array.isArray(result.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [];
        if (!Array.isArray(result.data) && !Array.isArray(result)) {
          console.warn('[GuardProfiles] Unexpected payouts response shape:', result);
        }
        setPayouts(payoutsArr);
      } else {
        setPayoutsError('Failed to load payouts');
      }
    } catch (err: any) {
      console.error('[GuardProfiles] Payouts fetch error:', err);
      setPayoutsError(err?.message || 'Network error loading payouts');
    }
    setPayoutsLoading(false);
  };

  const handleApprove = async () => {
    setLoading('approve');
    setConfirm(null);
    const newStatus = local.verification_status === 'approved' ? 'pending' : 'approved';
    const updates = {
      verification_status: newStatus,
      verified_at: newStatus === 'approved' ? new Date().toISOString() : null,
    };
    const result = await onUpdate(local.id, updates);
    if (result.success) {
      setLocal((p) => ({ ...p, ...updates }));
      showToast(newStatus === 'approved' ? 'Guard approved' : 'Approval removed');
      onAfterMutation(local.id, updates);
    } else {
      showToast(result.error || 'Failed to update status', 'error');
    }
    setLoading(null);
  };

  const handleToggleActive = async () => {
    setLoading('active');
    setConfirm(null);
    const updates = { is_active: !local.is_active };
    const result = await onUpdate(local.id, updates);
    if (result.success) {
      setLocal((p) => ({ ...p, ...updates }));
      showToast(local.is_active ? 'Guard deactivated' : 'Guard reactivated');
      onAfterMutation(local.id, updates);
    } else {
      showToast(result.error || 'Failed to update status', 'error');
    }
    setLoading(null);
  };

  const handleSaveNotes = async () => {
    setLoading('notes');
    const updates = { notes: notes.trim() || null };
    const result = await onUpdate(local.id, updates);
    if (result.success) {
      setLocal((p) => ({ ...p, ...updates }));
      setEditingNotes(false);
      showToast('Notes saved');
      onAfterMutation(local.id, updates);
    } else {
      showToast(result.error || 'Failed to save notes', 'error');
    }
    setLoading(null);
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <i key={i} className={`text-sm ${i < Math.round(rating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-slate-600'}`}></i>
    ));

  const siaExpired = local.sia_expiry_date ? new Date(local.sia_expiry_date) < new Date() : false;
  const siaExpiringSoon = local.sia_expiry_date
    ? new Date(local.sia_expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) && !siaExpired
    : false;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-user-line' },
    { key: 'sia', label: 'SIA & Licences', icon: 'ri-id-card-line' },
    { key: 'earnings', label: 'Earnings', icon: 'ri-money-pound-circle-line' },
    { key: 'reviews', label: 'Reviews', icon: 'ri-star-line' },
    { key: 'notes', label: 'Notes', icon: 'ri-sticky-note-line' },
  ];

  const statusColor =
    local.verification_status === 'approved' || local.verification_status === 'verified'
      ? 'bg-emerald-400/30 text-emerald-100'
      : local.verification_status === 'pending' || local.verification_status === 'manual_review' || local.verification_status === 'pending_sia_check'
      ? 'bg-amber-400/30 text-amber-100'
      : local.verification_status === 'rejected'
      ? 'bg-red-400/30 text-red-100'
      : local.verification_status === 'suspended'
      ? 'bg-orange-400/30 text-orange-100'
      : 'bg-white/20 text-white/70';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#111d35] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-[#1a2b4a]"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <i className={toast.type === 'error' ? 'ri-error-warning-fill' : 'ri-checkbox-circle-fill'}></i>
            {toast.msg}
          </div>
        )}

        {confirm && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-[#111d35] rounded-xl p-6 m-4 max-w-sm shadow-xl border border-[#1a2b4a]">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-500/10 rounded-full mx-auto mb-4">
                <i className="ri-error-warning-line text-2xl text-amber-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-center text-white mb-2">
                {confirm === 'approve'
                  ? local.verification_status === 'approved' ? 'Remove Approval?' : 'Approve Guard?'
                  : local.is_active ? 'Deactivate Guard?' : 'Reactivate Guard?'}
              </h3>
              <p className="text-sm text-slate-400 text-center mb-6">
                {confirm === 'approve'
                  ? local.verification_status === 'approved'
                    ? 'This will remove the approved status from this guard.'
                    : 'This will mark the guard as approved and allow them to take jobs.'
                  : local.is_active
                  ? 'This will prevent the guard from appearing in job searches.'
                  : 'This will restore the guard\'s active status.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-lg hover:bg-[#1a2b4a] cursor-pointer whitespace-nowrap">Cancel</button>
                <button
                  onClick={confirm === 'approve' ? handleApprove : handleToggleActive}
                  className={`flex-1 px-4 py-2 rounded-lg text-white cursor-pointer whitespace-nowrap ${confirm === 'active' && local.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-6 text-white relative flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
          <div className="flex items-center gap-4">
            <div title={local.full_name} className="w-16 h-16 flex items-center justify-center bg-white/20 rounded-xl text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{local.full_name}</h2>
              <p className="text-white/70 text-sm truncate">{local.email}</p>
              <p className="text-white/60 text-xs">{local.location || 'No location'}{local.postcode ? `, ${local.postcode}` : ''}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${statusColor}`}>
                  {local.verification_status || 'Unverified'}
                </span>
                {local.sia_verified && (
                  <span className="px-2 py-0.5 bg-blue-400/30 text-blue-100 text-xs rounded-full flex items-center gap-1">
                    <i className="ri-id-card-line"></i> SIA Verified
                  </span>
                )}
                {!local.is_active && (
                  <span className="px-2 py-0.5 bg-red-400/30 text-red-100 text-xs rounded-full">Inactive</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-[#0a1628] border-b border-[#1a2b4a] flex-shrink-0">
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-teal-400">{local.total_jobs_completed || 0}</p>
            <p className="text-xs text-slate-400">Jobs Done</p>
          </div>
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-purple-400">£{(local.total_earnings || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-400">Total Earned</p>
          </div>
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-yellow-400">{local.rating ? Number(local.rating).toFixed(1) : '—'}</p>
              {local.rating && <i className="ri-star-fill text-yellow-400 text-lg"></i>}
            </div>
            <p className="text-xs text-slate-400">{local.total_reviews || 0} reviews</p>
          </div>
          <div className="bg-[#111d35] rounded-xl p-3 text-center border border-[#1a2b4a]">
            <p className="text-2xl font-bold text-blue-400">{local.years_experience || 0}yr</p>
            <p className="text-xs text-slate-400">Experience</p>
          </div>
        </div>

        <div className="flex border-b border-[#1a2b4a] px-6 flex-shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.key ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className={t.icon}></i>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Profile Completeness</h3>
                <ChecklistProgress
                  title="Profile Fields"
                  items={[
                    { label: 'Full name', checked: !!local.full_name?.trim() },
                    { label: 'Email', checked: !!local.email?.trim() },
                    { label: 'Phone', checked: !!local.phone?.trim() },
                    { label: 'Location', checked: !!local.location?.trim() },
                    { label: 'SIA licence', checked: !!local.sia_licence_number?.trim() },
                    { label: 'SIA expiry', checked: !!local.sia_expiry_date },
                    { label: 'Experience', checked: local.years_experience != null && local.years_experience > 0 },
                    { label: 'Hourly rate', checked: !!local.hourly_rate && local.hourly_rate > 0 },
                    { label: 'Bio', checked: !!local.bio?.trim() },
                    { label: 'Profile photo', checked: !!local.profile_image_url?.trim() },
                    { label: 'Licence types', checked: !!local.licence_types && local.licence_types.length > 0 },
                    { label: 'Certifications', checked: !!local.certifications && local.certifications.length > 0 },
                    { label: 'Bank verified', checked: !!local.bank_account_verified },
                  ]}
                  color="teal"
                  showList={true}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="bg-[#0a1628] rounded-xl p-4 space-y-3">
                  {[
                    { icon: 'ri-mail-line', label: 'Email', value: local.email },
                    { icon: 'ri-phone-line', label: 'Phone', value: local.phone || 'Not provided' },
                    { icon: 'ri-map-pin-line', label: 'Location', value: [local.location, local.postcode].filter(Boolean).join(', ') || 'Not provided' },
                    { icon: 'ri-money-pound-circle-line', label: 'Hourly Rate', value: local.hourly_rate ? `£${local.hourly_rate}/hr` : 'Not set' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#111d35] rounded-lg flex-shrink-0">
                        <i className={`${row.icon} text-slate-400`}></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{row.label}</p>
                        <p className="text-sm font-medium text-white">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {local.bio && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Bio</h3>
                  <div className="bg-[#0a1628] rounded-xl p-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{local.bio}</p>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Availability & Travel</h3>
                <div className="bg-[#0a1628] rounded-xl p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Status</p>
                    <p className="text-sm font-medium text-white capitalize">{local.availability_status || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Willing to Travel</p>
                    <p className="text-sm font-medium text-white">{local.willing_to_travel ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Has Transport</p>
                    <p className="text-sm font-medium text-white">{local.has_transport ? 'Yes' : 'No'}</p>
                  </div>
                  {local.max_distance_miles && (
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Max Distance</p>
                      <p className="text-sm font-medium text-white">{local.max_distance_miles} miles</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sia' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">SIA Licence</h3>
                <div className={`rounded-xl p-4 border ${local.sia_verified ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[#0a1628] border-[#1a2b4a]'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${local.sia_verified ? 'bg-emerald-500/10' : 'bg-[#1a2b4a]'}`}>
                      <i className={`ri-id-card-line text-xl ${local.sia_verified ? 'text-emerald-400' : 'text-slate-400'}`}></i>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{local.sia_verified ? 'SIA Verified' : 'Not SIA Verified'}</p>
                      {local.sia_verified_at && (
                        <p className="text-xs text-slate-400">Verified on {new Date(local.sia_verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Licence Number</p>
                      <p className="text-sm font-mono font-medium text-white">{local.sia_licence_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Expiry Date</p>
                      <p className={`text-sm font-medium ${siaExpired ? 'text-red-400' : siaExpiringSoon ? 'text-amber-400' : 'text-white'}`}>
                        {local.sia_expiry_date
                          ? new Date(local.sia_expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                          : 'Not provided'}
                        {siaExpired && <span className="ml-2 text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">Expired</span>}
                        {siaExpiringSoon && <span className="ml-2 text-xs bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">Expiring Soon</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Licence Types</h3>
                <div className="flex flex-wrap gap-2">
                  {local.licence_types && local.licence_types.length > 0
                    ? local.licence_types.map((lt) => (
                        <span key={lt} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 text-sm rounded-lg font-medium">{lt}</span>
                      ))
                    : <p className="text-sm text-slate-500">No licence types listed</p>}
                </div>
              </div>
              {(local.sia_licence_front_url || local.sia_licence_back_url) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Licence Images</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SIALicenceImage
                      path={local.sia_licence_front_url || null}
                      label="Front of Licence"
                    />
                    {local.sia_licence_back_url && (
                      <SIALicenceImage
                        path={local.sia_licence_back_url}
                        label="Back of Licence"
                      />
                    )}
                  </div>
                  {local.sia_licence_uploaded_at && (
                    <p className="text-xs text-slate-500 mt-2">
                      Uploaded: {new Date(local.sia_licence_uploaded_at).toLocaleString('en-GB')}
                    </p>
                  )}
                </div>
              )}

              {local.certifications && local.certifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {local.certifications.map((cert) => (
                      <span key={cert} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-sm rounded-lg font-medium">{cert}</span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Account Details</h3>
                <div className="bg-[#0a1628] rounded-xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Verification Status</p>
                    <p className="text-sm font-medium text-white capitalize">{local.verification_status || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Bank Account</p>
                    <p className="text-sm font-medium text-white">{local.bank_account_verified ? 'Verified' : 'Not verified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Member Since</p>
                    <p className="text-sm font-medium text-white">
                      {local.created_at ? new Date(local.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Profile Status</p>
                    <p className="text-sm font-medium text-white">{local.profile_completed ? 'Complete' : 'Incomplete'}</p>
                  </div>
                  {local.rejection_reason && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-0.5">Rejection Reason</p>
                      <p className="text-sm text-red-400">{local.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Payouts</h3>
              {payoutsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : payoutsError ? (
                <div className="bg-[#0a1628] rounded-xl p-8 text-center">
                  <i className="ri-error-warning-line text-3xl text-red-400/60 mb-2 block"></i>
                  <p className="text-sm text-red-400">{payoutsError}</p>
                  <button onClick={fetchPayouts} className="mt-3 text-xs text-teal-400 hover:underline cursor-pointer">Retry</button>
                </div>
              ) : payouts.length === 0 ? (
                <div className="bg-[#0a1628] rounded-xl p-8 text-center">
                  <i className="ri-money-pound-circle-line text-3xl text-slate-600 mb-2 block"></i>
                  <p className="text-sm text-slate-500">No payouts recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p) => (
                    <div key={p.id} className="bg-[#0a1628] rounded-xl p-4 flex items-center justify-between border border-[#1a2b4a]">
                      <div>
                        <p className="text-sm font-medium text-white">£{Number(p.net_amount || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{p.reference_number || 'No reference'}</p>
                        <p className="text-xs text-slate-600">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        p.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                        p.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-[#1a2b4a] text-slate-400'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Guard Reviews</h3>
                {local.rating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">{renderStars(local.rating)}</div>
                    <span className="text-sm font-semibold text-white">{Number(local.rating).toFixed(1)}</span>
                    <span className="text-xs text-slate-400">({local.total_reviews || 0} reviews)</span>
                  </div>
                )}
              </div>
              {reviewsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : reviewsError ? (
                <div className="bg-[#0a1628] rounded-xl p-8 text-center">
                  <i className="ri-error-warning-line text-3xl text-red-400/60 mb-2 block"></i>
                  <p className="text-sm text-red-400">{reviewsError}</p>
                  <button onClick={fetchReviews} className="mt-3 text-xs text-teal-400 hover:underline cursor-pointer">Retry</button>
                </div>
              ) : reviews.length === 0 ? (
                <div className="bg-[#0a1628] rounded-xl p-8 text-center">
                  <i className="ri-star-line text-3xl text-slate-600 mb-2 block"></i>
                  <p className="text-sm text-slate-500">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="bg-[#0a1628] rounded-xl p-4 border border-[#1a2b4a]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-0.5">{renderStars(r.rating)}</div>
                        <span className="text-xs text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—'}</span>
                      </div>
                      {r.review_text && <p className="text-sm text-slate-300">{r.review_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Admin Notes</h3>
                {!editingNotes && (
                  <button onClick={() => setEditingNotes(true)} className="text-xs text-teal-400 hover:bg-teal-500/10 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <i className="ri-edit-line"></i>
                    {local.notes ? 'Edit' : 'Add Note'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    placeholder="Add internal notes about this guard..."
                    className="w-full h-28 px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-[#0a1628] text-white placeholder-slate-500"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500">{notes.length}/500</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setNotes(local.notes || ''); setEditingNotes(false); }} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-[#1a2b4a] rounded-lg cursor-pointer whitespace-nowrap">Cancel</button>
                      <button onClick={handleSaveNotes} disabled={loading === 'notes'} className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1">
                        {loading === 'notes' ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 min-h-[80px]">
                  {local.notes ? (
                    <p className="text-sm text-slate-300">{local.notes}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No notes yet. Click Add Note to add one.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#1a2b4a] px-6 py-4 bg-[#0a1628] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirm('approve')}
              disabled={loading !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors ${
                local.verification_status === 'approved'
                  ? 'bg-[#1a2b4a] text-slate-400 hover:bg-[#1e2d4d]'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {loading === 'approve' ? <i className="ri-loader-4-line animate-spin"></i> : <i className={local.verification_status === 'approved' ? 'ri-close-circle-line' : 'ri-checkbox-circle-line'}></i>}
              {local.verification_status === 'approved' ? 'Remove Approval' : 'Approve Guard'}
            </button>
            <button
              onClick={() => setConfirm('active')}
              disabled={loading !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors ${
                local.is_active
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading === 'active' ? <i className="ri-loader-4-line animate-spin"></i> : <i className={local.is_active ? 'ri-forbid-line' : 'ri-user-follow-line'}></i>}
              {local.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
            <a href={`mailto:${local.email}`} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-400 rounded-lg hover:bg-teal-500/20 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors">
              <i className="ri-mail-send-line"></i>
              Email Guard
            </a>
          </div>
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:bg-[#1a2b4a] rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap">Close</button>
        </div>
      </div>
    </div>
  );
}