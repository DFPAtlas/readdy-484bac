'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import SIALicenceImage from '@/components/SIALicenceImage';

interface Guard {
  id: string;
  user_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  sia_licence_number: string;
  license_cardholder_name?: string;
  sia_expiry_date: string;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  sia_licence_uploaded_at?: string | null;
  licence_types: string[];
  years_experience?: number;
  experience_years?: number;
  verification_status: string;
  created_at: string;
  address_line1: string;
  city: string;
  postcode: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ConfirmModal {
  show: boolean;
  guardId: string;
  guardName: string;
  status: 'approved' | 'rejected';
}

interface BulkConfirmModal {
  show: boolean;
  action: 'approve' | 'reject';
  count: number;
}

export default function VerifyGuardsClient() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkConfirmModal, setBulkConfirmModal] = useState<BulkConfirmModal>({ show: false, action: 'approve', count: 0 });
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    show: false,
    guardId: '',
    guardName: '',
    status: 'approved'
  });

  useEffect(() => {
    fetchGuards();
  }, [filter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const getGuardName = (guard: Guard): string => {
    if (guard.full_name) return guard.full_name;
    if (guard.first_name && guard.last_name) return `${guard.first_name} ${guard.last_name}`;
    if (guard.first_name) return guard.first_name;
    return 'Unknown Guard';
  };

  const fetchGuards = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guards?status=${filter}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setGuards(result.data || []);
    } catch (error: any) {
      console.error('Error fetching guards:', error);
      showToast('Failed to load guards', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmModal = (guardId: string, status: 'approved' | 'rejected') => {
    const guard = guards.find(g => g.id === guardId);
    if (!guard) return;

    setConfirmModal({
      show: true,
      guardId,
      guardName: getGuardName(guard),
      status
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      show: false,
      guardId: '',
      guardName: '',
      status: 'approved'
    });
  };

  const handleVerification = async () => {
    const { guardId, status } = confirmModal;
    
    closeConfirmModal();
    setProcessingId(guardId);
    
    try {
      const guard = guards.find(g => g.id === guardId);
      if (!guard) {
        throw new Error('Guard not found in local state');
      }

      const updateData: any = {
        verification_status: status,
        is_active: status === 'approved'
      };

      if (status === 'approved') {
        updateData.verified_at = new Date().toISOString();
        updateData.sia_verified_at = new Date().toISOString();
      } else {
        updateData.rejected_at = new Date().toISOString();
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('guards')
        .update(updateData)
        .eq('id', guardId)
        .select('*');

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }
      
      if (!updatedData || updatedData.length === 0) {
        console.error('No data returned from update - guard may not exist');
        throw new Error('Failed to update guard - record not found');
      }

      if (guard.user_id) {
        const notificationData = {
          user_id: guard.user_id,
          user_type: 'guard',
          title: status === 'approved' ? 'Application Approved ✓' : 'Application Update',
          message: status === 'approved' 
            ? 'Congratulations! Your guard application has been approved. You can now start accepting jobs and will receive email updates about new opportunities.'
            : 'Your guard application requires additional review. Our team will contact you shortly.',
          type: status === 'approved' ? 'success' : 'warning',
          is_read: false,
          link: '/guard/dashboard',
          created_at: new Date().toISOString()
        };

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select();

        if (notifError) {
          console.error('Notification error:', notifError);
        }
      }

      const guardName = getGuardName(guard);
      let emailSent = false;
      
      try {
        const emailPayload = {
          guardEmail: guard.email,
          guardName: guardName,
          approved: status === 'approved'
        };

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || '';

        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-guard-approval-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(emailPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Email sending failed:', errorText);
        } else {
          emailSent = true;
        }
      } catch (error: any) {
        console.error('Email sending error:', error.message);
      }

      await logAdminAction({
        actionType: status === 'approved' ? 'guard_verified' : 'guard_rejected',
        actionDescription: status === 'approved'
          ? `Approved guard application for ${guardName}`
          : `Rejected guard application for ${guardName}`,
        targetType: 'guard',
        targetName: guardName,
        metadata: { guardId: guard.id, email: guard.email, siaLicence: guard.sia_licence_number },
      });

      setGuards(prevGuards => prevGuards.filter(g => g.id !== guardId));
      
      if (emailSent) {
        showToast(
          status === 'approved' 
            ? `${guardName} approved! Email notification sent successfully.` 
            : `${guardName} rejected and notified via email.`,
          'success'
        );
      } else {
        showToast(
          status === 'approved' 
            ? `${guardName} approved! ⚠️ Email notification failed (domain not verified). Guard can still access the platform.` 
            : `${guardName} rejected. ⚠️ Email notification failed.`,
          'success'
        );
      }
      
    } catch (error: any) {
      console.error('Verification failed:', error);
      showToast(
        `Failed to ${status === 'approved' ? 'approve' : 'reject'} guard: ${error.message || 'Unknown error'}`,
        'error'
      );
      await fetchGuards();
    } finally {
      setProcessingId(null);
    }
  };

  const handleQuickApprove = async (guardId: string) => {
    setProcessingId(guardId);
    try {
      const guard = guards.find(g => g.id === guardId);
      if (!guard) throw new Error('Guard not found');

      const updateData: any = {
        verification_status: 'approved',
        is_active: true,
        sia_verified: true,
        verified_at: new Date().toISOString(),
        sia_verified_at: new Date().toISOString()
      };

      const { data: updatedData, error: updateError } = await supabase
        .from('guards')
        .update(updateData)
        .eq('id', guardId)
        .select('*');

      if (updateError) throw new Error(`Update failed: ${updateError.message}`);
      if (!updatedData || updatedData.length === 0) throw new Error('Record not found');

      if (guard.user_id) {
        const notificationData = {
          user_id: guard.user_id,
          user_type: 'guard',
          title: 'Application Approved ✓',
          message: 'Congratulations! Your guard application has been approved. You can now start accepting jobs and will receive email updates about new opportunities.',
          type: 'success',
          is_read: false,
          link: '/guard/dashboard',
          created_at: new Date().toISOString()
        };

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select();

        if (notifError) console.error('Notification error:', notifError);
      }

      const guardName = getGuardName(guard);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || '';

        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-guard-approval-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            guardEmail: guard.email,
            guardName: guardName,
            approved: true
          })
        });
      } catch (e) {
        console.error('Email sending error:', e);
      }

      await logAdminAction({
        actionType: 'guard_verified',
        actionDescription: `Quick-approved guard application for ${guardName}`,
        targetType: 'guard',
        targetName: guardName,
        metadata: { guardId: guard.id, email: guard.email, siaLicence: guard.sia_licence_number, quickApprove: true },
      });

      setGuards(prevGuards => prevGuards.filter(g => g.id !== guardId));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(guardId); return next; });
      showToast(`${guardName} quick-approved!`, 'success');
    } catch (error: any) {
      console.error('Quick approve failed:', error);
      showToast(`Quick approve failed: ${error.message || 'Unknown error'}`, 'error');
      await fetchGuards();
    } finally {
      setProcessingId(null);
    }
  };

  const handleQuickReject = async (guardId: string) => {
    setProcessingId(guardId);
    try {
      const guard = guards.find(g => g.id === guardId);
      if (!guard) throw new Error('Guard not found');

      const updateData: any = {
        verification_status: 'rejected',
        is_active: false,
        sia_verified: false,
        rejected_at: new Date().toISOString()
      };

      const { data: updatedData, error: updateError } = await supabase
        .from('guards')
        .update(updateData)
        .eq('id', guardId)
        .select('*');

      if (updateError) throw new Error(`Update failed: ${updateError.message}`);
      if (!updatedData || updatedData.length === 0) throw new Error('Record not found');

      if (guard.user_id) {
        const notificationData = {
          user_id: guard.user_id,
          user_type: 'guard',
          title: 'Application Update',
          message: 'Your guard application requires additional review. Our team will contact you shortly.',
          type: 'warning',
          is_read: false,
          link: '/guard/dashboard',
          created_at: new Date().toISOString()
        };

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select();

        if (notifError) console.error('Notification error:', notifError);
      }

      const guardName = getGuardName(guard);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || '';

        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-guard-approval-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            guardEmail: guard.email,
            guardName: guardName,
            approved: false
          })
        });
      } catch (e) {
        console.error('Email sending error:', e);
      }

      await logAdminAction({
        actionType: 'guard_rejected',
        actionDescription: `Quick-rejected guard application for ${guardName}`,
        targetType: 'guard',
        targetName: guardName,
        metadata: { guardId: guard.id, email: guard.email, siaLicence: guard.sia_licence_number, quickReject: true },
      });

      setGuards(prevGuards => prevGuards.filter(g => g.id !== guardId));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(guardId); return next; });
      showToast(`${guardName} quick-rejected!`, 'success');
    } catch (error: any) {
      console.error('Quick reject failed:', error);
      showToast(`Quick reject failed: ${error.message || 'Unknown error'}`, 'error');
      await fetchGuards();
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(guards.map(g => g.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkQuickApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkConfirmModal({ show: true, action: 'approve', count: selectedIds.size });
  };

  const handleBulkQuickReject = async () => {
    if (selectedIds.size === 0) return;
    setBulkConfirmModal({ show: true, action: 'reject', count: selectedIds.size });
  };

  const executeBulkAction = async () => {
    const { action } = bulkConfirmModal;
    setBulkConfirmModal({ show: false, action: 'approve', count: 0 });
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const guardId of ids) {
      try {
        const guard = guards.find(g => g.id === guardId);
        if (!guard) { failCount++; continue; }

        if (action === 'approve') {
          const updateData = {
            verification_status: 'approved',
            is_active: true,
            sia_verified: true,
            verified_at: new Date().toISOString(),
            sia_verified_at: new Date().toISOString()
          };

          const { data: updatedData, error: updateError } = await supabase
            .from('guards')
            .update(updateData)
            .eq('id', guardId)
            .select('*');

          if (updateError || !updatedData || updatedData.length === 0) { failCount++; continue; }

          if (guard.user_id) {
            const notificationData = {
              user_id: guard.user_id,
              user_type: 'guard',
              title: 'Application Approved ✓',
              message: 'Congratulations! Your guard application has been approved. You can now start accepting jobs and will receive email updates about new opportunities.',
              type: 'success',
              is_read: false,
              link: '/guard/dashboard',
              created_at: new Date().toISOString()
            };
            await supabase.from('notifications').insert(notificationData).select();
          }

          const guardName = getGuardName(guard);

          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token || '';

            await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-guard-approval-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ guardEmail: guard.email, guardName, approved: true })
            });
          } catch (e) { console.error('Email error:', e); }

          await logAdminAction({
            actionType: 'guard_verified',
            actionDescription: `Bulk quick-approved guard application for ${getGuardName(guard)}`,
            targetType: 'guard',
            targetName: getGuardName(guard),
            metadata: { guardId: guard.id, email: guard.email, siaLicence: guard.sia_licence_number, bulkApprove: true },
          });
        } else {
          const updateData = {
            verification_status: 'rejected',
            is_active: false,
            sia_verified: false,
            rejected_at: new Date().toISOString()
          };

          const { data: updatedData, error: updateError } = await supabase
            .from('guards')
            .update(updateData)
            .eq('id', guardId)
            .select('*');

          if (updateError || !updatedData || updatedData.length === 0) { failCount++; continue; }

          if (guard.user_id) {
            const notificationData = {
              user_id: guard.user_id,
              user_type: 'guard',
              title: 'Application Update',
              message: 'Your guard application requires additional review. Our team will contact you shortly.',
              type: 'warning',
              is_read: false,
              link: '/guard/dashboard',
              created_at: new Date().toISOString()
            };
            await supabase.from('notifications').insert(notificationData).select();
          }

          const guardName = getGuardName(guard);

          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token || '';

            await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-guard-approval-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ guardEmail: guard.email, guardName, approved: false })
            });
          } catch (e) { console.error('Email error:', e); }

          await logAdminAction({
            actionType: 'guard_rejected',
            actionDescription: `Bulk quick-rejected guard application for ${guardName}`,
            targetType: 'guard',
            targetName: guardName,
            metadata: { guardId: guard.id, email: guard.email, siaLicence: guard.sia_licence_number, bulkReject: true },
          });
        }

        successCount++;
      } catch (e) {
        failCount++;
        console.error(`Bulk ${action} failed for ${guardId}:`, e);
      }
    }

    setGuards(prevGuards => prevGuards.filter(g => !selectedIds.has(g.id)));
    setSelectedIds(new Set());
    setBulkProcessing(false);

    if (successCount > 0) {
      showToast(`${successCount} guard${successCount > 1 ? 's' : ''} bulk-${action}ed! ${failCount > 0 ? `(${failCount} failed)` : ''}`, 'success');
    } else {
      showToast(`Bulk ${action} failed for all ${failCount} guards`, 'error');
    }
    await fetchGuards();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              confirmModal.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <i className={`text-4xl ${
                confirmModal.status === 'approved' 
                  ? 'ri-checkbox-circle-line text-green-600' 
                  : 'ri-close-circle-line text-red-600'
              }`}></i>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
              {confirmModal.status === 'approved' ? 'Approve Guard?' : 'Reject Guard?'}
            </h3>
            
            <p className="text-gray-600 text-center mb-6">
              {confirmModal.status === 'approved' ? (
                <>
                  <span className="font-semibold text-gray-900">{confirmModal.guardName}</span> will be able to:
                  <ul className="mt-3 text-left space-y-2">
                    <li className="flex items-start gap-2">
                      <i className="ri-check-line text-green-600 mt-0.5"></i>
                      <span>Browse and apply for jobs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-check-line text-green-600 mt-0.5"></i>
                      <span>Receive email notifications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-check-line text-green-600 mt-0.5"></i>
                      <span>Access their dashboard</span>
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{confirmModal.guardName}</span> will be notified of the rejection and moved to the Rejected tab.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleVerification}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-colors whitespace-nowrap ${
                  confirmModal.status === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmModal.status === 'approved' ? 'Yes, Approve' : 'Yes, Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkConfirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              bulkConfirmModal.action === 'approve' ? 'bg-teal-100' : 'bg-red-100'
            }`}>
              <i className={`text-4xl ${
                bulkConfirmModal.action === 'approve' 
                  ? 'ri-flashlight-line text-teal-600' 
                  : 'ri-close-circle-line text-red-600'
              }`}></i>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
              {bulkConfirmModal.action === 'approve' ? 'Bulk Approve?' : 'Bulk Reject?'}
            </h3>
            
            <p className="text-gray-600 text-center mb-6">
              You are about to <span className="font-semibold text-gray-900">{bulkConfirmModal.action === 'approve' ? 'approve' : 'reject'} {bulkConfirmModal.count} guard{bulkConfirmModal.count > 1 ? 's' : ''}</span>. 
              This action cannot be undone. Each guard will be notified via email.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setBulkConfirmModal({ show: false, action: 'approve', count: 0 })}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-colors whitespace-nowrap ${
                  bulkConfirmModal.action === 'approve'
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Yes, {bulkConfirmModal.action === 'approve' ? 'Approve All' : 'Reject All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <i className={`text-2xl ${
              toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'
            }`}></i>
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setFilter('pending'); deselectAll(); }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <i className="ri-time-line mr-2"></i>
          Pending
        </button>
        <button
          onClick={() => { setFilter('approved'); deselectAll(); }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'approved'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <i className="ri-checkbox-circle-line mr-2"></i>
          Approved
        </button>
        <button
          onClick={() => { setFilter('rejected'); deselectAll(); }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'rejected'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <i className="ri-close-circle-line mr-2"></i>
          Rejected
        </button>
      </div>

      {filter === 'pending' && guards.length > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <button
            onClick={selectAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors whitespace-nowrap text-sm"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors whitespace-nowrap text-sm"
          >
            Deselect
          </button>
          <div className="text-sm text-gray-600 ml-2">
            {selectedIds.size} selected
          </div>
          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleBulkQuickReject}
                disabled={bulkProcessing}
                className="px-5 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm flex items-center gap-2"
              >
                {bulkProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <i className="ri-close-circle-line"></i>
                    Bulk Quick Reject
                  </>
                )}
              </button>
              <button
                onClick={handleBulkQuickApprove}
                disabled={bulkProcessing}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm flex items-center gap-2"
              >
                {bulkProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <i className="ri-flashlight-line"></i>
                    Bulk Quick Approve
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading guards...</p>
        </div>
      ) : guards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="ri-user-search-line text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Guards Found</h3>
          <p className="text-gray-600">There are no {filter} guards at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {guards.map((guard) => {
            const licenceTypes = guard.licence_types || [];
            const guardName = getGuardName(guard);
            const experienceYears = guard.years_experience || guard.experience_years || 0;
            
            return (
              <div key={guard.id} className={`bg-white rounded-xl border p-6 ${selectedIds.has(guard.id) ? 'border-teal-400 ring-2 ring-teal-100' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    {filter === 'pending' && (
                      <div className="pt-1">
                        <button
                          onClick={() => toggleSelect(guard.id)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(guard.id)
                              ? 'bg-teal-600 border-teal-600'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {selectedIds.has(guard.id) && (
                            <i className="ri-check-line text-white text-sm"></i>
                          )}
                        </button>
                      </div>
                    )}
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="ri-shield-user-line text-3xl text-blue-600"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {guardName}
                      </h3>
                      <p className="text-gray-600">{guard.email}</p>
                      <p className="text-gray-600">{guard.phone}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Applied: {formatDate(guard.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    guard.verification_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : guard.verification_status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {guard.verification_status === 'approved' ? 'Approved' : 
                     guard.verification_status.charAt(0).toUpperCase() + guard.verification_status.slice(1)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SIA Licence Details</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Licence Number:</span>
                        <span className="text-sm font-semibold text-gray-900">{guard.sia_licence_number}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Cardholder Name:</span>
                        <span className="text-sm font-semibold text-gray-900">{guard.license_cardholder_name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Expiry Date:</span>
                        <span className={`text-sm font-semibold ${
                          isExpired(guard.sia_expiry_date)
                            ? 'text-red-600'
                            : isExpiringSoon(guard.sia_expiry_date)
                            ? 'text-yellow-600'
                            : 'text-gray-900'
                        }`}>
                          {formatDate(guard.sia_expiry_date)}
                          {isExpired(guard.sia_expiry_date) && ' (Expired)'}
                          {isExpiringSoon(guard.sia_expiry_date) && !isExpired(guard.sia_expiry_date) && ' (Expiring Soon)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Experience</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Years:</span>
                        <span className="text-sm font-semibold text-gray-900">{experienceYears} years</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Location:</span>
                        <span className="text-sm font-semibold text-gray-900">{guard.city}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {(guard.sia_licence_front_url || guard.sia_licence_back_url) && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SIA Licence Images</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guard.sia_licence_front_url && (
                        <SIALicenceImage path={guard.sia_licence_front_url} label="Front" />
                      )}
                      {guard.sia_licence_back_url && (
                        <SIALicenceImage path={guard.sia_licence_back_url} label="Back" />
                      )}
                    </div>
                    {guard.sia_licence_uploaded_at && (
                      <p className="text-xs text-gray-400 mt-2">Uploaded: {new Date(guard.sia_licence_uploaded_at).toLocaleString('en-GB')}</p>
                    )}
                  </div>
                )}
                {!guard.sia_licence_front_url && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <i className="ri-error-warning-line text-amber-600"></i>
                      <p className="text-sm font-medium text-amber-800">No licence images uploaded</p>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Licence Types</h4>
                  {licenceTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {licenceTypes.map((type, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No licence types specified</p>
                  )}
                </div>

                {filter === 'pending' && (
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleQuickApprove(guard.id)}
                      disabled={processingId === guard.id}
                      className="bg-teal-600 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                      title="Quick approve - skips confirmation modal"
                    >
                      {processingId === guard.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        <>
                          <i className="ri-flashlight-line mr-1"></i>
                          Quick Approve
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openConfirmModal(guard.id, 'approved')}
                      disabled={processingId === guard.id}
                      className="bg-green-600 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                    >
                      <i className="ri-checkbox-circle-line mr-1"></i>
                      Approve
                    </button>
                    <button
                      onClick={() => handleQuickReject(guard.id)}
                      disabled={processingId === guard.id}
                      className="bg-orange-600 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                      title="Quick reject - skips confirmation modal"
                    >
                      {processingId === guard.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        <>
                          <i className="ri-flashlight-line mr-1"></i>
                          Quick Reject
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openConfirmModal(guard.id, 'rejected')}
                      disabled={processingId === guard.id}
                      className="bg-red-600 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                    >
                      <i className="ri-close-circle-line mr-1"></i>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
