'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GuardVerification, GuardStatus, matchesSearch, getSiaCheckStatusBadge, getSiaCheckStatusText, getApprovalBlockers } from './types';
import RequestInfoModal from './RequestInfoModal';
import Toast from './Toast';
import GuardTable from './GuardTable';
import GuardMobileCard from './GuardMobileCard';
import GuardHeaderCard from './GuardHeaderCard';
import ReviewTabs from './ReviewTabs';
import OverviewTab from './OverviewTab';
import LicenceReviewPanel from './LicenceReviewPanel';
import ProfessionalTab from './ProfessionalTab';
import AvailabilityTab from './AvailabilityTab';
import VerificationFooter from './VerificationFooter';
import RejectModal from './RejectModal';
import ApproveConfirmModal from './ApproveConfirmModal';
import OverrideApproveModal from './OverrideApproveModal';
import VerificationSkeleton from './VerificationSkeleton';
import DocumentsReviewPanel from './DocumentsReviewPanel';
import AccountTab from './AccountTab';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

type DetailTab = 'overview' | 'licence' | 'documents' | 'professional' | 'availability' | 'account';

interface VerificationChecks {
  personal_info: boolean;
  sia_license: boolean;
  documents: boolean;
  professional_details: boolean;
  availability: boolean;
  subscription: boolean;
}

const defaultChecks: VerificationChecks = {
  personal_info: false,
  sia_license: false,
  documents: false,
  professional_details: false,
  availability: false,
  subscription: false,
};

const statusTabs: { key: GuardStatus; label: string; countKey: string }[] = [
  { key: 'pending', label: 'Pending', countKey: 'pending' },
  { key: 'approved', label: 'Approved', countKey: 'approved' },
  { key: 'rejected', label: 'Rejected', countKey: 'rejected' },
  { key: 'suspended', label: 'Suspended', countKey: 'suspended' },
  { key: 'incomplete', label: 'Incomplete', countKey: 'incomplete' },
  { key: 'all', label: 'All', countKey: 'all' },
];

export default function GuardVerificationsClient() {
  const admin = useAdminAuth();
  const [guards, setGuards] = useState<GuardVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GuardStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuard, setSelectedGuard] = useState<GuardVerification | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [verificationChecks, setVerificationChecks] = useState<VerificationChecks>({ ...defaultChecks });
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0, suspended: 0, incomplete: 0, all: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const [requestInfoGuard, setRequestInfoGuard] = useState<GuardVerification | null>(null);

  const fetchGuards = useCallback(async (status: GuardStatus) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guards`;
      const isIncomplete = status === 'incomplete';
      const apiStatus = status === 'incomplete' || status === 'all' ? 'all' : status;
      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: apiStatus, incompleteOnly: isIncomplete }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || `Edge Function returned ${response.status}`);
      }

      const result = await response.json();
      const normalizedGuards = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.guards)
            ? result.guards
            : [];

      const allGuards = normalizedGuards.map((guard: any) => ({
        ...guard,
        verification_checks: { ...defaultChecks },
      }));

      if (status === 'all') {
        setGuards(allGuards);
      } else if (status === 'incomplete') {
        setGuards(allGuards.filter((g: GuardVerification) => g.profile_completed !== true));
      } else {
        setGuards(allGuards);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch guards';
      showToast(message, 'error');
      setGuards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllCounts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guards`;
      const statuses = ['pending', 'approved', 'rejected', 'suspended', 'all'];
      const results = await Promise.all(
        statuses.map(async (s) => {
          const res = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ status: s }),
          });
          if (!res.ok) return { status: s, count: 0 };
          const data = await res.json();
          const guards = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
          return { status: s, count: guards.length };
        })
      );

      const newCounts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, suspended: 0, incomplete: 0, all: 0 };
      results.forEach((r) => {
        if (r.status === 'all') {
          newCounts.all = r.count;
        } else {
          newCounts[r.status] = r.count;
        }
      });

      const incompleteRes = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'all', incompleteOnly: true }),
      });
      if (incompleteRes.ok) {
        const data = await incompleteRes.json();
        const incompleteGuards = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        newCounts.incomplete = incompleteGuards.length;
      }

      setCounts(newCounts);
    } catch {
      // silently fail counts
    }
  }, []);

  useEffect(() => {
    fetchGuards(activeTab);
    fetchAllCounts();
  }, [activeTab, fetchGuards, fetchAllCounts]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const filteredGuards = guards.filter((g) => matchesSearch(g, searchQuery));

  const openGuardDetails = (guard: GuardVerification) => {
    setDetailLoading(true);
    setSelectedGuard(guard);
    setVerificationChecks(guard.verification_checks || { ...defaultChecks });
    setDetailTab('overview');
    setTimeout(() => setDetailLoading(false), 250);
  };

  const closeGuardDetails = () => {
    setSelectedGuard(null);
    setVerificationChecks({ ...defaultChecks });
  };

  const toggleCheck = (section: keyof VerificationChecks) => {
    setVerificationChecks((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const allChecksCompleted = () => Object.values(verificationChecks).every((c) => c);

  const handleApprove = async () => {
    if (!selectedGuard) return;
    const blockers = getApprovalBlockers(selectedGuard);
    if (blockers.length > 0) {
      showToast(`Cannot approve — missing: ${blockers.join(', ')}`, 'error');
      return;
    }
    if (!allChecksCompleted()) {
      showToast('Please confirm all sections before approving', 'error');
      return;
    }
    setShowApproveModal(true);
  };

  const handleOverrideApprove = () => {
    if (!selectedGuard) return;
    setShowOverrideModal(true);
  };

  const confirmOverrideApprove = async () => {
    if (!selectedGuard) return;
    setShowOverrideModal(false);
    setProcessing(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-verify-guard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId: selectedGuard.id,
            action: 'approve',
            adminName,
            override: true,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        const detail = result.details ? ': ' + result.details : '';
        throw new Error((result.error || `Server returned ${response.status}`) + detail);
      }

      showToast('Guard force-approved via override!', 'success');
      closeGuardDetails();
      fetchGuards(activeTab);
      fetchAllCounts();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Override approval error:', msg);
      showToast('Override failed: ' + msg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const confirmApprove = async () => {
    if (!selectedGuard) return;
    setShowApproveModal(false);
    setProcessing(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-verify-guard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId: selectedGuard.id,
            action: 'approve',
            adminName,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        const detail = result.details ? ': ' + result.details : '';
        throw new Error((result.error || `Server returned ${response.status}`) + detail);
      }

      showToast('Guard approved successfully!', 'success');
      closeGuardDetails();
      fetchGuards(activeTab);
      fetchAllCounts();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Approval error:', msg);
      showToast('Approval failed: ' + msg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedGuard) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    setProcessing(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const unconfirmedSections = Object.entries(verificationChecks)
        .filter(([_, checked]) => !checked)
        .map(([section]) => section.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-verify-guard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId: selectedGuard.id,
            action: 'reject',
            rejectionReason,
            unconfirmedSections,
            adminName,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        const detail = result.details ? ': ' + result.details : '';
        throw new Error((result.error || `Server returned ${response.status}`) + detail);
      }

      showToast('Guard rejected. Notification email sent.', 'success');
      setShowRejectModal(false);
      setRejectionReason('');
      closeGuardDetails();
      fetchGuards(activeTab);
      fetchAllCounts();
    } catch (error) {
      console.error('Rejection error:', error);
      showToast('Failed to reject guard. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySiaCheck = async (guard: GuardVerification) => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sia-check`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guard_id: guard.id,
            sia_licence_number: guard.sia_licence_number,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        const detail = result.details ? ': ' + result.details : '';
        throw new Error((result.error || `Server returned ${response.status}`) + detail);
      }
      showToast(`SIA check completed. Status: ${result.verification_status}`, result.verification_status === 'verified' ? 'success' : 'error');
      closeGuardDetails();
      fetchGuards(activeTab);
      fetchAllCounts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SIA check failed';
      showToast(message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSiaOverride = async (guard: GuardVerification) => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-verify-guard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId: guard.id,
            action: 'manual_sia_verify',
            adminName: admin.username || 'admin',
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        const detail = result.details ? ': ' + result.details : '';
        throw new Error((result.error || `Server returned ${response.status}`) + detail);
      }
      showToast('SIA manually verified successfully!', 'success');
      closeGuardDetails();
      fetchGuards(activeTab);
      fetchAllCounts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Manual SIA override failed';
      showToast(message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestInfo = (guard: GuardVerification) => {
    setRequestInfoGuard(guard);
  };

  const hasLicenceImages = selectedGuard && (selectedGuard.sia_licence_front_url || selectedGuard.sia_licence_back_url);
  const hasDocuments = selectedGuard && (selectedGuard.driving_licence_front_url || selectedGuard.driving_licence_back_url || selectedGuard.proof_of_address_url);

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <Toast toast={toast} />

      <div className="bg-[#111d35] border-b border-[#1a2b4a] sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">
                <div className="w-8 h-8 flex items-center justify-center">
                  <i className="ri-arrow-left-line text-xl"></i>
                </div>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Guard Verifications</h1>
                <p className="text-sm text-slate-400">Review, approve, and manage guard applications</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/add-guard"
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-user-add-line text-sm"></i>
                </div>
                Add Guard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#1a2b4a]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-[#1a2b4a] p-1 rounded-xl overflow-x-auto">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.key ? 'bg-[#111d35] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === tab.key ? 'bg-teal-500/10 text-teal-400' : 'bg-[#0a1628] text-slate-400'
                    }`}>
                      {counts[tab.countKey] || 0}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-search-line text-slate-500 text-sm"></i>
                  </div>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, SIA, phone..."
                  className="block w-full pl-9 pr-3 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-[#0a1628] text-white placeholder-slate-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-close-line text-slate-400 text-sm"></i>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-3 bg-[#0a1628] border-b border-[#1a2b4a] flex items-center justify-between">
            <p className="text-sm text-slate-400">{loading ? 'Loading...' : `${filteredGuards.length} result${filteredGuards.length !== 1 ? 's' : ''}`}</p>
            <p className="text-xs text-slate-500 hidden sm:block">Tab: {statusTabs.find((t) => t.key === activeTab)?.label}</p>
          </div>

          {loading ? (
            <div className="p-8">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-[#0a1628] rounded-xl border border-[#1a2b4a] animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[#1a2b4a] flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="w-32 h-4 bg-[#1a2b4a] rounded"></div>
                      <div className="w-48 h-3 bg-[#1a2b4a] rounded"></div>
                    </div>
                    <div className="w-20 h-8 bg-[#1a2b4a] rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-[#1a2b4a] rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-shield-check-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No guards found</h3>
              <p className="text-sm text-slate-400">
                {searchQuery ? 'Try adjusting your search query' : 'No guards in this category yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <GuardTable guards={filteredGuards} onReview={openGuardDetails} onRequestInfo={handleRequestInfo} />
              </div>
              <div className="md:hidden">
                <div className="divide-y divide-[#1a2b4a]">
                  {filteredGuards.map((guard) => (
                    <GuardMobileCard key={guard.id} guard={guard} onReview={() => openGuardDetails(guard)} onRequestInfo={() => handleRequestInfo(guard)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedGuard && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111d35] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-[#1a2b4a]">
            <div className="sticky top-0 bg-[#111d35] border-b border-[#1a2b4a] px-6 sm:px-8 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Verify Guard Application</h2>
                <p className="text-sm text-slate-400 mt-1">Review each section and confirm the information</p>
              </div>
              <button onClick={closeGuardDetails} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <div className="w-8 h-8 flex items-center justify-center"><i className="ri-close-line text-2xl"></i></div>
              </button>
            </div>

            <ReviewTabs activeTab={detailTab} hasLicenceImages={!!hasLicenceImages} hasDocuments={!!hasDocuments} onTabChange={setDetailTab} />

            <div className="px-6 sm:px-8 py-6 space-y-6">
              <GuardHeaderCard guard={selectedGuard} hasLicenceImages={!!hasLicenceImages} />
              {detailLoading ? (
                <VerificationSkeleton />
              ) : (
                <>
                  {detailTab === 'overview' && (<OverviewTab guard={selectedGuard} checks={verificationChecks} hasLicenceImages={!!hasLicenceImages} onToggle={(s) => toggleCheck(s as keyof VerificationChecks)} onViewLicence={() => setDetailTab('licence')} />)}
                  {detailTab === 'licence' && (<LicenceReviewPanel guard={selectedGuard} hasLicenceImages={!!hasLicenceImages} checked={verificationChecks.sia_license} onToggle={() => toggleCheck('sia_license')} />)}
                  {detailTab === 'documents' && (<DocumentsReviewPanel guard={selectedGuard} checked={verificationChecks.documents} onToggle={() => toggleCheck('documents')} />)}
                  {detailTab === 'professional' && (<ProfessionalTab guard={selectedGuard} checked={verificationChecks.professional_details} onToggle={() => toggleCheck('professional_details')} />)}
                  {detailTab === 'availability' && (<AvailabilityTab guard={selectedGuard} checked={verificationChecks.availability} onToggle={() => toggleCheck('availability')} />)}
                  {detailTab === 'account' && (<AccountTab guard={selectedGuard} checked={verificationChecks.subscription} onToggle={() => toggleCheck('subscription')} />)}
                </>
              )}

              {(() => {
                const siaBadge = getSiaCheckStatusBadge(selectedGuard.sia_check_status, selectedGuard.verification_status);
                const siaText = getSiaCheckStatusText(selectedGuard.sia_check_status, selectedGuard.verification_status);
                return (
                  <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center">
                          <i className="ri-shield-check-line text-teal-400 w-4 h-4 flex items-center justify-center"></i>
                        </div>
                        SIA Check Status
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ${siaBadge.color} inline-flex items-center gap-1.5`}>
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className={`${siaBadge.icon} text-xs`}></i>
                        </div>
                        {siaBadge.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{siaText}</p>
                    {selectedGuard.sia_checked_at && (
                      <p className="text-xs text-slate-500 mb-3">Last checked: {new Date(selectedGuard.sia_checked_at).toLocaleString()}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => handleRetrySiaCheck(selectedGuard)}
                        disabled={processing || !selectedGuard.sia_licence_number}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-2 cursor-pointer"
                      >
                        {processing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Running...
                          </>
                        ) : (
                          <>
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                            Retry SIA Check
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleManualSiaOverride(selectedGuard)}
                        disabled={processing}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-2 cursor-pointer"
                      >
                        {processing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-user-voice-line"></i></div>
                            Manual Verify SIA
                          </>
                        )}
                      </button>
                      {selectedGuard.sia_raw_result_json && (
                        <button
                          onClick={() => {
                            const raw = JSON.stringify(selectedGuard.sia_raw_result_json, null, 2);
                            showToast(`Last SIA result: ${raw.substring(0, 200)}`, 'success');
                          }}
                          className="px-4 py-2 bg-[#1a2b4a] text-slate-300 rounded-lg text-sm font-medium hover:bg-[#223558] transition whitespace-nowrap inline-flex items-center gap-2 cursor-pointer"
                        >
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-code-line"></i></div>
                          View Last Result
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const blockers = getApprovalBlockers(selectedGuard);
                if (blockers.length === 0) return null;
                return (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center"></i>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-400 mb-1">Cannot approve yet — missing required items</p>
                          <ul className="text-sm text-red-400/80 space-y-0.5">
                            {blockers.map((b) => (
                              <li key={b} className="flex items-center gap-2">
                                <i className="ri-close-circle-line w-3.5 h-3.5 flex items-center justify-center"></i>
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestInfo(selectedGuard)}
                        className="px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 transition whitespace-nowrap inline-flex items-center gap-2 cursor-pointer"
                      >
                        <i className="ri-mail-send-line w-4 h-4 flex items-center justify-center"></i>
                        Request Missing Info
                      </button>
                    </div>
                  </div>
                );
              })()}

              <VerificationFooter checks={verificationChecks} processing={processing} allChecksCompleted={allChecksCompleted()} hasBlockers={getApprovalBlockers(selectedGuard).length > 0} onApprove={handleApprove} onReject={() => setShowRejectModal(true)} onOverride={handleOverrideApprove} />
            </div>
          </div>
        </div>
      )}

      <RejectModal open={showRejectModal} processing={processing} reason={rejectionReason} onReasonChange={setRejectionReason} onCancel={() => { setShowRejectModal(false); setRejectionReason(''); }} onConfirm={handleReject} />
      <ApproveConfirmModal open={showApproveModal} guardName={selectedGuard?.full_name || 'this guard'} onCancel={() => setShowApproveModal(false)} onConfirm={confirmApprove} />
      <OverrideApproveModal open={showOverrideModal} guardName={selectedGuard?.full_name || 'this guard'} blockerCount={selectedGuard ? getApprovalBlockers(selectedGuard).length : 0} onCancel={() => setShowOverrideModal(false)} onConfirm={confirmOverrideApprove} />
      {requestInfoGuard && (
        <RequestInfoModal
          guard={requestInfoGuard}
          onClose={() => setRequestInfoGuard(null)}
          onSent={() => {
            setRequestInfoGuard(null);
            showToast('Missing information request sent to guard', 'success');
            closeGuardDetails();
            fetchGuards(activeTab);
            fetchAllCounts();
          }}
        />
      )}
    </div>
  );
}