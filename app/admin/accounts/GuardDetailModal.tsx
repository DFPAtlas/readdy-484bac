'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import ChecklistProgress from '../guard-verifications/ChecklistProgress';
import DeleteUserModal from '@/components/admin/DeleteUserModal';

interface Guard {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  sia_licence_number: string | null;
  sia_license_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean | null;
  verification_status: string;
  is_active: boolean | null;
  years_experience: number | null;
  hourly_rate: number | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  completed_jobs: number | null;
  total_earnings: number | null;
  specializations: string[] | null;
  certifications: string[] | null;
  profile_completed: boolean | null;
  bio: string | null;
  availability: string | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  bank_status?: 'verified' | 'pending' | 'missing';
}

interface GuardDetailModalProps {
  guard: Guard;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function GuardDetailModal({ guard, onClose, onUpdate }: GuardDetailModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [localGuard, setLocalGuard] = useState(guard);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(guard.notes || '');
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const displayName = localGuard.first_name && localGuard.last_name
    ? `${localGuard.first_name} ${localGuard.last_name}`
    : localGuard.full_name;
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const siaNumber = localGuard.sia_license_number || localGuard.sia_licence_number;
  const jobsDone = localGuard.total_jobs_completed || localGuard.completed_jobs || 0;

  useEffect(() => {
    async function fetchGuardReviews() {
      setReviewsLoading(true);
      try {
        const { data } = await supabase
          .from('reviews')
          .select('id, rating, review_text, status, created_at, client_id')
          .eq('guard_id', guard.id)
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (!data || data.length === 0) {
          setReviews([]);
          setReviewsLoading(false);
          return;
        }

        const clientIds = [...new Set(data.map(r => r.client_id).filter(Boolean))];
        let clientMap: Record<string, string> = {};
        if (clientIds.length > 0) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id, company_name, first_name, last_name')
            .in('id', clientIds);
          (clientData || []).forEach((c: any) => {
            clientMap[c.id] = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown Client';
          });
        }

        const reviewsWithClients = data.map(review => ({
          ...review,
          client_name: clientMap[review.client_id || ''] || 'Unknown Client',
        }));

        setReviews(reviewsWithClients);
      } catch (err) {
        console.error('Error fetching guard reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    }
    fetchGuardReviews();
  }, [guard.id]);

  useEffect(() => {
    async function checkSuperAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('admin_users').select('role').eq('user_id', session.user.id).maybeSingle();
      if (data && data.role === 'super_admin') setIsSuperAdmin(true);
    }
    checkSuperAdmin();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveGuard = async () => {
    setIsLoading('approve');
    setShowConfirm(null);
    try {
      const { error } = await supabase
        .from('guards')
        .update({ verification_status: 'approved', is_active: true })
        .eq('id', localGuard.id);

      if (error) throw error;

      setLocalGuard(prev => ({ ...prev, verification_status: 'approved', is_active: true }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Guard approved: ${displayName} (${localGuard.email})`,
        targetType: 'guard',
        targetName: displayName,
        metadata: { guardId: localGuard.id, action: 'approve' },
      });
      showToast('Guard approved successfully', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error approving guard:', err);
      showToast('Failed to approve guard', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleRejectGuard = async () => {
    setIsLoading('reject');
    setShowConfirm(null);
    try {
      const { error } = await supabase
        .from('guards')
        .update({ verification_status: 'rejected', is_active: false })
        .eq('id', localGuard.id);

      if (error) throw error;

      setLocalGuard(prev => ({ ...prev, verification_status: 'rejected', is_active: false }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Guard rejected: ${displayName} (${localGuard.email})`,
        targetType: 'guard',
        targetName: displayName,
        metadata: { guardId: localGuard.id, action: 'reject' },
      });
      showToast('Guard rejected', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error rejecting guard:', err);
      showToast('Failed to reject guard', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSuspendGuard = async () => {
    setIsLoading('suspend');
    setShowConfirm(null);
    try {
      const newActive = !localGuard.is_active;
      const { error } = await supabase
        .from('guards')
        .update({ is_active: newActive })
        .eq('id', localGuard.id);

      if (error) throw error;

      setLocalGuard(prev => ({ ...prev, is_active: newActive }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Guard ${newActive ? 'reactivated' : 'suspended'}: ${displayName} (${localGuard.email})`,
        targetType: 'guard',
        targetName: displayName,
        metadata: { guardId: localGuard.id, action: newActive ? 'reactivate' : 'suspend' },
      });
      showToast(newActive ? 'Guard reactivated' : 'Guard suspended', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error suspending/reactivating guard:', err);
      showToast('Failed to update guard status', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleVerifySIA = async () => {
    setIsLoading('sia');
    setShowConfirm(null);
    try {
      const newSIA = !localGuard.sia_verified;
      const { error } = await supabase
        .from('guards')
        .update({ sia_verified: newSIA })
        .eq('id', localGuard.id);

      if (error) throw error;

      setLocalGuard(prev => ({ ...prev, sia_verified: newSIA }));
      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Guard SIA ${newSIA ? 'verified' : 'unverified'}: ${displayName} (${localGuard.email})`,
        targetType: 'guard',
        targetName: displayName,
        metadata: { guardId: localGuard.id, action: newSIA ? 'verify_sia' : 'unverify_sia' },
      });
      showToast(newSIA ? 'SIA verified successfully' : 'SIA verification removed', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error updating SIA verification:', err);
      showToast('Failed to update SIA verification', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSendEmail = () => {
    window.location.href = `mailto:${localGuard.email}`;
  };

  const handleSaveNotes = async () => {
    setIsLoading('notes');
    try {
      const { error } = await supabase
        .from('guards')
        .update({ notes: notesValue.trim() || null })
        .eq('id', localGuard.id);

      if (error) throw error;

      setLocalGuard(prev => ({ ...prev, notes: notesValue.trim() || null }));
      setIsEditingNotes(false);
      await logAdminAction({
        actionType: 'admin_note_added',
        actionDescription: `Note updated for guard: ${displayName} (${localGuard.email})`,
        targetType: 'guard',
        targetName: displayName,
        metadata: { guardId: localGuard.id },
      });
      showToast('Admin notes saved', 'success');
      onUpdate?.();
    } catch (err) {
      console.error('Error saving notes:', err);
      showToast('Failed to save notes', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleCancelNotes = () => {
    setNotesValue(localGuard.notes || '');
    setIsEditingNotes(false);
  };

  const guardProfileItems = [
    { label: 'First name', checked: !!localGuard.first_name?.trim() },
    { label: 'Last name', checked: !!localGuard.last_name?.trim() },
    { label: 'Email', checked: !!localGuard.email?.trim() },
    { label: 'Phone', checked: !!localGuard.phone?.trim() },
    { label: 'City', checked: !!localGuard.city?.trim() },
    { label: 'Postcode', checked: !!localGuard.postcode?.trim() },
    { label: 'Address', checked: !!localGuard.address?.trim() },
    { label: 'Date of birth', checked: !!localGuard.date_of_birth?.trim() },
    { label: 'Emergency contact', checked: !!localGuard.emergency_contact_name?.trim() && !!localGuard.emergency_contact_phone?.trim() },
    { label: 'Bio', checked: !!localGuard.bio?.trim() },
    { label: 'Years experience', checked: localGuard.years_experience != null && localGuard.years_experience > 0 },
    { label: 'Hourly rate', checked: localGuard.hourly_rate != null && localGuard.hourly_rate > 0 },
    { label: 'SIA licence number', checked: !!(localGuard.sia_licence_number?.trim() || localGuard.sia_license_number?.trim()) },
    { label: 'Specializations', checked: !!localGuard.specializations && localGuard.specializations.length > 0 },
    { label: 'Certifications', checked: !!localGuard.certifications && localGuard.certifications.length > 0 },
  ];

  const guardProfilePercent = Math.round((guardProfileItems.filter(i => i.checked).length / guardProfileItems.length) * 100);
  const guardIncompleteFields = guardProfileItems.filter(i => !i.checked).map(i => i.label);
  const isGuardProfileIncomplete = guardProfilePercent < 100;

  const handleNudgeGuard = async () => {
    setIsLoading('nudge');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-profile-nudge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            guard_email: localGuard.email,
            guard_name: displayName,
            incomplete_fields: guardIncompleteFields,
            profile_percent: guardProfilePercent,
            profile_url: '/guard/profile',
            user_type: 'guard',
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }
      showToast('Profile nudge email sent successfully', 'success');
    } catch (err) {
      console.error('Error sending nudge:', err);
      showToast('Failed to send nudge email', 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (localGuard.verification_status === 'approved' && localGuard.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/30">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-checkbox-circle-fill text-xs"></i></div>
          Active
        </span>
      );
    }
    if (localGuard.verification_status === 'approved' && !localGuard.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-400/20 text-slate-200 ring-1 ring-slate-400/30">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-forbid-line text-xs"></i></div>
          Suspended
        </span>
      );
    }
    if (localGuard.verification_status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-time-line text-xs"></i></div>
          Pending Verification
        </span>
      );
    }
    if (localGuard.verification_status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/20 text-red-100 ring-1 ring-red-400/30">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-circle-fill text-xs"></i></div>
          Rejected
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#0a1628] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-[#1a2b4a] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className="w-5 h-5 flex items-center justify-center"><i className={toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}></i></div>
            {toast.message}
          </div>
        )}

        {showConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-[#0a1628] rounded-2xl p-6 m-4 max-w-sm shadow-xl border border-[#1a2b4a]">
              <div className={`w-12 h-12 flex items-center justify-center rounded-full mx-auto mb-4 ring-1 ${
                showConfirm === 'reject' || (showConfirm === 'suspend' && localGuard.is_active) ? 'bg-red-500/10 ring-red-500/20' :
                showConfirm === 'approve' ? 'bg-emerald-500/10 ring-emerald-500/20' : 'bg-sky-500/10 ring-sky-500/20'
              }`}>
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`text-2xl ${
                    showConfirm === 'reject' ? 'ri-close-circle-line text-red-400' :
                    showConfirm === 'suspend' && localGuard.is_active ? 'ri-forbid-line text-red-400' :
                    showConfirm === 'approve' ? 'ri-checkbox-circle-line text-emerald-400' :
                    'ri-verified-badge-line text-sky-400'
                  }`}></i>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-center mb-2 text-white">
                {showConfirm === 'approve' && 'Approve Guard?'}
                {showConfirm === 'reject' && 'Reject Guard?'}
                {showConfirm === 'suspend' && (localGuard.is_active ? 'Suspend Guard?' : 'Reactivate Guard?')}
                {showConfirm === 'sia' && (localGuard.sia_verified ? 'Remove SIA Verification?' : 'Verify SIA Licence?')}
              </h3>
              <p className="text-sm text-slate-400 text-center mb-6">
                {showConfirm === 'approve' && 'This will approve the guard and allow them to apply for jobs.'}
                {showConfirm === 'reject' && 'This will reject the guard application. They will need to reapply.'}
                {showConfirm === 'suspend' && (localGuard.is_active 
                  ? 'This will suspend the guard and prevent them from working on jobs.'
                  : 'This will reactivate the guard account and allow them to work again.')}
                {showConfirm === 'sia' && (localGuard.sia_verified
                  ? 'This will remove the SIA verification badge from this guard.'
                  : 'This will mark the SIA licence as verified.')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (showConfirm === 'approve') handleApproveGuard();
                    else if (showConfirm === 'reject') handleRejectGuard();
                    else if (showConfirm === 'suspend') handleSuspendGuard();
                    else if (showConfirm === 'sia') handleVerifySIA();
                  }}
                  disabled={isLoading !== null}
                  className={`flex-1 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-white disabled:opacity-50 ${
                    showConfirm === 'reject' || (showConfirm === 'suspend' && localGuard.is_active)
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isLoading === showConfirm ? 'Working...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-8 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors cursor-pointer"
          >
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-xl"></i></div>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center bg-white/15 rounded-full text-3xl font-bold ring-1 ring-white/20">
              {initials}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <p className="text-white/80">{localGuard.city || 'Location not set'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {getStatusBadge()}
                {localGuard.sia_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-400/20 text-sky-100 ring-1 ring-sky-400/30">
                    <div className="w-3 h-3 flex items-center justify-center"><i className="ri-verified-badge-fill text-xs"></i></div>
                    SIA Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-amber-500/10 rounded-2xl p-4 text-center ring-1 ring-amber-500/20">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-star-fill text-amber-400 text-xs"></i></div>
                <p className="text-2xl font-bold text-amber-400">{localGuard.rating ? Number(localGuard.rating).toFixed(1) : '-'}</p>
              </div>
              <p className="text-xs text-slate-400">{localGuard.total_reviews || 0} reviews</p>
            </div>
            <div className="bg-sky-500/10 rounded-2xl p-4 text-center ring-1 ring-sky-500/20">
              <p className="text-2xl font-bold text-sky-400">{jobsDone}</p>
              <p className="text-xs text-slate-400">Jobs Done</p>
            </div>
            <div className="bg-emerald-500/10 rounded-2xl p-4 text-center ring-1 ring-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-400">
                &pound;{(localGuard.total_earnings || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Total Earned</p>
            </div>
            <div className="bg-violet-500/10 rounded-2xl p-4 text-center ring-1 ring-violet-500/20">
              <p className="text-2xl font-bold text-violet-400">{localGuard.years_experience || 0}</p>
              <p className="text-xs text-slate-400">Years Exp.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-star-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Client Reviews</h3>
                <span className="text-xs text-slate-500">({reviews.length})</span>
              </div>
              {reviewsLoading ? (
                <div className="bg-[#111d35] rounded-2xl p-6 ring-1 ring-[#1a2b4a] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                </div>
              ) : reviews.length === 0 ? (
                <div className="bg-[#111d35] rounded-2xl p-6 ring-1 ring-[#1a2b4a] text-center">
                  <div className="w-10 h-10 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-2">
                    <i className="ri-star-line text-slate-500 text-lg"></i>
                  </div>
                  <p className="text-sm text-slate-400">No published reviews yet</p>
                </div>
              ) : (
                <div className="bg-[#111d35] rounded-2xl ring-1 ring-[#1a2b4a] divide-y divide-[#1a2b4a] max-h-[240px] overflow-y-auto">
                  {reviews.map((review) => (
                    <div key={review.id} className="px-4 py-3 hover:bg-[#0a1628]/50 transition">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <div key={s} className="w-3.5 h-3.5 flex items-center justify-center">
                              <i className={`${s <= review.rating ? 'ri-star-fill text-amber-400' : 'ri-star-line text-slate-600'} text-xs`}></i>
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{review.review_text}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">&mdash; {review.client_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                    <i className="ri-checkbox-circle-line text-sm text-slate-400"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profile Completeness</h3>
                </div>
                {isGuardProfileIncomplete && (
                  <button
                    onClick={handleNudgeGuard}
                    disabled={isLoading === 'nudge'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors cursor-pointer ring-1 ring-amber-500/20 disabled:opacity-50"
                  >
                    {isLoading === 'nudge' ? (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                    ) : (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                    )}
                    Nudge: Complete Profile
                  </button>
                )}
              </div>
              <ChecklistProgress
                title="Profile Fields"
                items={guardProfileItems}
                color="green"
                showList={true}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-user-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Contact Information</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 space-y-3 ring-1 ring-[#1a2b4a]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-mail-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-200">{localGuard.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-phone-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-200">{localGuard.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#0a1628] rounded-lg shadow-sm ring-1 ring-[#1a2b4a]">
                    <i className="ri-map-pin-line text-slate-400"></i>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-200">
                      {[localGuard.address, localGuard.city, localGuard.postcode].filter(Boolean).join(', ') || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-shield-keyhole-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">SIA Licence Details</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 grid grid-cols-2 gap-4 ring-1 ring-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500">Licence Number</p>
                  <p className="text-sm font-medium text-slate-200 font-mono">{siaNumber || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Expiry Date</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localGuard.sia_expiry_date
                      ? new Date(localGuard.sia_expiry_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Verification Status</p>
                  <p className="text-sm font-medium">
                    {localGuard.sia_verified ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-verified-badge-fill text-xs"></i></div>
                        Verified
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium">Unverified</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Hourly Rate</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localGuard.hourly_rate ? `£${localGuard.hourly_rate}/hr` : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {(localGuard.specializations?.length || localGuard.certifications?.length) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                    <i className="ri-award-line text-sm text-slate-400"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Skills &amp; Certifications</h3>
                </div>
                <div className="bg-[#111d35] rounded-2xl p-4 space-y-4 ring-1 ring-[#1a2b4a]">
                  {localGuard.specializations && localGuard.specializations.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Specializations</p>
                      <div className="flex flex-wrap gap-2">
                        {localGuard.specializations.map((spec, idx) => (
                          <span key={idx} className="px-3 py-1 bg-sky-500/10 text-sky-300 rounded-full text-xs font-medium ring-1 ring-sky-500/20">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {localGuard.certifications && localGuard.certifications.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Certifications</p>
                      <div className="flex flex-wrap gap-2">
                        {localGuard.certifications.map((cert, idx) => (
                          <span key={idx} className="px-3 py-1 bg-emerald-500/10 text-emerald-300 rounded-full text-xs font-medium ring-1 ring-emerald-500/20">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {localGuard.bio && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                    <i className="ri-file-text-line text-sm text-slate-400"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Bio</h3>
                </div>
                <div className="bg-[#111d35] rounded-2xl p-4 ring-1 ring-[#1a2b4a]">
                  <p className="text-sm text-slate-300">{localGuard.bio}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-contacts-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Emergency Contact</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 grid grid-cols-2 gap-4 ring-1 ring-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500">Contact Name</p>
                  <p className="text-sm font-medium text-slate-200">{localGuard.emergency_contact_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Contact Phone</p>
                  <p className="text-sm font-medium text-slate-200">{localGuard.emergency_contact_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                  <i className="ri-time-line text-sm text-slate-400"></i>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Account Activity</h3>
              </div>
              <div className="bg-[#111d35] rounded-2xl p-4 grid grid-cols-2 gap-4 ring-1 ring-[#1a2b4a]">
                <div>
                  <p className="text-xs text-slate-500">Member Since</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localGuard.created_at
                      ? new Date(localGuard.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Login</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localGuard.last_login
                      ? new Date(localGuard.last_login).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Account ID</p>
                  <p className="text-sm font-medium text-slate-200 font-mono">{localGuard.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date of Birth</p>
                  <p className="text-sm font-medium text-slate-200">
                    {localGuard.date_of_birth
                      ? new Date(localGuard.date_of_birth).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2b4a] ring-1 ring-[#1a2b4a]">
                    <i className="ri-sticky-note-line text-sm text-slate-400"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Admin Notes</h3>
                </div>
                {!isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-500/10 rounded-xl transition-colors cursor-pointer ring-1 ring-teal-500/20"
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-edit-line"></i></div>
                    {localGuard.notes ? 'Edit' : 'Add Note'}
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 ring-1 ring-amber-500/20">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Add internal notes about this guard..."
                    className="w-full h-24 px-3 py-2 text-sm border border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent resize-none bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-400">{notesValue.length}/500 characters</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelNotes}
                        disabled={isLoading === 'notes'}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:bg-[#1a2b4a] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={isLoading === 'notes'}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isLoading === 'notes' ? (
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                        ) : (
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 min-h-[60px] ring-1 ring-amber-500/20">
                  {localGuard.notes ? (
                    <p className="text-sm text-slate-200">{localGuard.notes}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No admin notes yet. Click &quot;Add Note&quot; to add one.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="border-t border-[#1a2b4a]">
            <div className="px-6 py-4 bg-red-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-400">Danger Zone</p>
                  <p className="text-xs text-slate-500 mt-0.5">Permanently delete this guard and all associated data</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ring-1 ring-red-500/20"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                  Delete Guard Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-[#1a2b4a] px-6 py-4 bg-[#0a1628]/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {localGuard.verification_status === 'pending' && (
                <>
                  <button
                    onClick={() => setShowConfirm('approve')}
                    disabled={isLoading !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                  >
                    {isLoading === 'approve' ? (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                    ) : (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-checkbox-circle-line"></i></div>
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowConfirm('reject')}
                    disabled={isLoading !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                  >
                    {isLoading === 'reject' ? (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                    ) : (
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-circle-line"></i></div>
                    )}
                    Reject
                  </button>
                </>
              )}
              {localGuard.verification_status === 'approved' && (
                <button
                  onClick={() => setShowConfirm('suspend')}
                  disabled={isLoading !== null}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50 ${
                    localGuard.is_active
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isLoading === 'suspend' ? (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className={localGuard.is_active ? 'ri-forbid-line' : 'ri-user-follow-line'}></i></div>
                  )}
                  {localGuard.is_active ? 'Suspend' : 'Reactivate'}
                </button>
              )}
              <button
                onClick={() => setShowConfirm('sia')}
                disabled={isLoading !== null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50 ${
                  localGuard.sia_verified
                    ? 'bg-[#1a2b4a] text-slate-300 hover:bg-[#243553]'
                    : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {isLoading === 'sia' ? (
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-verified-badge-line"></i></div>
                )}
                {localGuard.sia_verified ? 'Remove SIA' : 'Verify SIA'}
              </button>
              <button
                onClick={handleSendEmail}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl hover:bg-teal-500/20 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium ring-1 ring-teal-500/20"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                Email
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:bg-[#1a2b4a] hover:text-white rounded-xl transition-colors font-medium cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteUserModal
          userId={localGuard.id}
          userName={localGuard.first_name && localGuard.last_name ? `${localGuard.first_name} ${localGuard.last_name}` : localGuard.full_name}
          userEmail={localGuard.email}
          userType="guard"
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            onClose();
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}