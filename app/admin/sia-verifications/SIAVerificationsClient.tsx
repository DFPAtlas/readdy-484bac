'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import Link from 'next/link';
import DocumentThumbnail from './DocumentThumbnail';
import ProfileAvatar from './ProfileAvatar';
import Pagination from '@/components/Pagination';

interface GuardDocPaths {
  profile_image_path: string | null;
  sia_licence_front_path: string | null;
  sia_licence_back_path: string | null;
  sia_supporting_document_path: string | null;
}

interface VerificationEntry {
  guardId: string;
  userId: string;
  fullName: string;
  email: string;
  siaLicenseNumber: string;
  verificationStatus: string;
  siaVerified: boolean;
  siaCheckStatus: string | null;
  licenseStatus: string | null;
  licenseExpiry: string | null;
  siaSectors: string[] | null;
  verificationDetails: string | null;
  siaVerifiedAt: string | null;
  createdAt: string;
  confidenceScore: number | null;
  guardDocs: GuardDocPaths | null;
}

interface Stats {
  totalPending: number;
  totalVerified: number;
  totalRejected: number;
  totalExpired: number;
  expiringIn30Days: number;
}

const PAGE_SIZE = 10;

export default function SIAVerificationsClient() {
  const [entries, setEntries] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'expiry'>('date');
  const [stats, setStats] = useState<Stats>({ totalPending: 0, totalVerified: 0, totalRejected: 0, totalExpired: 0, expiringIn30Days: 0 });
  const [retriggering, setRetriggering] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCardUser, setSelectedCardUser] = useState<VerificationEntry | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (p: number, f: string, s: string, sb: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('admin-sia-verifications', {
        body: { action: 'list', page: p, pageSize: PAGE_SIZE, search: s, filter: f, sortBy: sb },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to load verifications');
      if (result?.error) throw new Error(result.error);

      const list = Array.isArray(result?.data) ? result.data : [];
      setEntries(list);
      setTotalCount(result?.totalCount || 0);

      if (result?.stats) {
        setStats(result.stats);
      }
    } catch (err: any) {
      console.error('Error fetching SIA verifications:', err);
      setError(err.message || 'Failed to load verifications');
      setEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('admin-sia-verifications', {
        body: { action: 'stats' },
      });
      if (!fnError && result?.stats) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Error fetching SIA stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, filter, debouncedSearch, sortBy);
  }, [page, filter, debouncedSearch, sortBy]);

  useEffect(() => {
    const channel = supabase
      .channel('sia-verifications-guard-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'guards' },
        (payload: any) => {
          const changedFields = Object.keys(payload.new || {});
          const siaFields = ['verification_status', 'sia_verified', 'sia_check_status', 'sia_confidence_score', 'sia_scraped_status', 'sia_scraped_expiry_date', 'sia_checked_at', 'sia_licence_number'];
          const relevantChange = siaFields.some(f => changedFields.includes(f));
          if (relevantChange) {
            fetchPage(page, filter, debouncedSearch, sortBy);
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [page, filter, debouncedSearch, sortBy]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleRetriggerVerification = async (entry: VerificationEntry) => {
    setRetriggering(entry.guardId);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('sia-check', {
        body: { guard_id: entry.guardId, sia_licence_number: entry.siaLicenseNumber },
      });

      if (fnError) throw new Error(fnError.message || 'SIA check call failed');
      if (result?.error) throw new Error(result.error);

      const statusMessage = result?.verification_status === 'manual_review'
        ? 'SIA check triggered. Manual review required — webhook may not be configured.'
        : `SIA check completed. Status: ${result?.verification_status || 'processing'}`;

      await logAdminAction({
        actionType: 'sia_check_retriggered',
        actionDescription: `Re-triggered SIA verification for ${entry.fullName} (guard ${entry.guardId})`,
        targetType: 'guard',
        targetName: entry.fullName,
        metadata: { guardId: entry.guardId, licenseNumber: entry.siaLicenseNumber, result: result },
      });

      await fetchPage(page, filter, debouncedSearch, sortBy);
      await fetchStats();
      setToast({ message: statusMessage, type: 'success' });
    } catch (err: any) {
      console.error('Error re-triggering SIA verification:', err);
      setToast({ message: err.message || 'Failed to re-trigger verification', type: 'error' });
    } finally {
      setRetriggering(null);
    }
  };

  const downloadUserCSV = (entry: VerificationEntry) => {
    const headers = ['Field', 'Value'];
    const rows = [
      ['Full Name', entry.fullName || 'N/A'],
      ['Email', entry.email],
      ['SIA License Number', entry.siaLicenseNumber || 'N/A'],
      ['Verification Status', entry.verificationStatus],
      ['License Status', entry.licenseStatus || 'N/A'],
      ['License Expiry', formatDate(entry.licenseExpiry)],
      ['Verified At', formatDate(entry.siaVerifiedAt)],
      ['SIA Sectors', (entry.siaSectors || []).join(', ') || 'N/A'],
      ['Verification Details', entry.verificationDetails || 'N/A'],
      ['SIA Check Status', entry.siaCheckStatus || 'N/A'],
      ['Confidence Score', entry.confidenceScore != null ? String(entry.confidenceScore) : 'N/A'],
      ['Account Created', formatDate(entry.createdAt)],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const text = String(cell).replace(/"/g, '""');
        return (text.includes(',') || text.includes('"') || text.includes('\n')) ? `"${text}"` : text;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const safeName = (entry.fullName || 'guard').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    link.setAttribute('download', `${safeName}_SIA_Verification_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({ message: `Downloaded CSV for ${entry.fullName || entry.email}`, type: 'success' });
  };

  const openCard = (entry: VerificationEntry) => { setSelectedCardUser(entry); };
  const closeCard = () => { setSelectedCardUser(null); };
  const printCard = () => { window.print(); };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', icon: 'ri-checkbox-circle-fill' };
      case 'pending': return { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', icon: 'ri-time-line' };
      case 'rejected': return { bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20', icon: 'ri-close-circle-fill' };
      case 'expired': return { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20', icon: 'ri-error-warning-fill' };
      default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', icon: 'ri-question-line' };
    }
  };

  const getLicenseStatusColor = (status: string | null) => {
    switch (status) {
      case 'valid': return 'text-emerald-400';
      case 'expired': return 'text-orange-400';
      case 'revoked': return 'text-red-400';
      case 'not_found': return 'text-slate-400';
      default: return 'text-slate-500';
    }
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const hasAnyDocs = (docs: GuardDocPaths | null): boolean => {
    if (!docs) return false;
    return !!(docs.profile_image_path || docs.sia_licence_front_path || docs.sia_licence_back_path || docs.sia_supporting_document_path);
  };

  const handleFilterChange = (f: typeof filter) => {
    setFilter(f);
    setPage(1);
  };

  const handleSortChange = (s: typeof sortBy) => {
    setSortBy(s);
    setPage(1);
  };

  const statCards = [
    { label: 'Pending Verifications', count: stats.totalPending, icon: 'ri-time-line', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400', border: 'border-[#1a2b4a]' },
    { label: 'Verified Users', count: stats.totalVerified, icon: 'ri-checkbox-circle-line', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', border: 'border-[#1a2b4a]' },
    { label: 'Rejected', count: stats.totalRejected, icon: 'ri-close-circle-line', iconBg: 'bg-red-500/10', iconColor: 'text-red-400', border: 'border-[#1a2b4a]' },
    { label: 'Expired', count: stats.totalExpired, icon: 'ri-error-warning-line', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-400', border: 'border-[#1a2b4a]' },
    { label: 'Expiring Soon', count: stats.expiringIn30Days, icon: 'ri-alarm-warning-line', iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-400', border: 'border-[#1a2b4a]' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border text-sm font-semibold transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            : 'bg-red-500/10 text-red-300 border-red-500/20'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-error-warning-fill text-red-400'} text-lg`}></i>
          </div>
          {toast.message}
        </div>
      )}

      {selectedCardUser && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 print:hidden" onClick={closeCard}>
            <div className="bg-[#0a1628] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-[#1a2b4a]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
                <h3 className="text-lg font-bold text-white">SIA Verification Card</h3>
                <button onClick={closeCard} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] transition-colors cursor-pointer">
                  <i className="ri-close-line text-xl text-slate-400"></i>
                </button>
              </div>

              <div className="p-6 bg-[#0B1933]">
                <div className="bg-[#0a1628] rounded-2xl border border-[#1a2b4a] overflow-hidden shadow-lg">
                  <div className="bg-[#1a2b4a] px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                        <i className="ri-shield-check-fill text-2xl text-emerald-400"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security License</p>
                        <p className="text-white font-bold text-lg leading-tight">SIA Verification Card</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                      <p className={`text-sm font-bold ${selectedCardUser.verificationStatus === 'verified' ? 'text-emerald-400' : selectedCardUser.verificationStatus === 'pending' ? 'text-amber-400' : 'text-red-400'}`}>
                        {selectedCardUser.verificationStatus.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-[#1a2b4a] flex items-center justify-center flex-shrink-0">
                        <i className="ri-shield-user-line text-3xl text-slate-400"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License Holder</p>
                        <p className="text-xl font-extrabold text-white truncate">{selectedCardUser.fullName || 'N/A'}</p>
                        <p className="text-sm text-slate-400 font-medium">{selectedCardUser.email}</p>
                      </div>
                    </div>

                    <div className="h-px bg-[#1a2b4a]"></div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SIA License Number</p>
                        <p className="text-base font-bold text-white font-mono">{selectedCardUser.siaLicenseNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License Status</p>
                        <p className={`text-base font-bold ${getLicenseStatusColor(selectedCardUser.licenseStatus)}`}>{selectedCardUser.licenseStatus ? selectedCardUser.licenseStatus.toUpperCase() : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</p>
                        <p className={`text-base font-bold ${isExpiringSoon(selectedCardUser.licenseExpiry) ? 'text-orange-400' : 'text-white'}`}>{formatDate(selectedCardUser.licenseExpiry)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verified Date</p>
                        <p className="text-base font-bold text-white">{formatDate(selectedCardUser.siaVerifiedAt)}</p>
                      </div>
                    </div>

                    {selectedCardUser.siaSectors && selectedCardUser.siaSectors.length > 0 && (
                      <>
                        <div className="h-px bg-[#1a2b4a]"></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Authorized Sectors</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedCardUser.siaSectors.map((sector, index) => (
                              <span key={index} className="px-3 py-1 bg-[#1a2b4a] text-slate-300 rounded-lg text-xs font-bold">{sector}</span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedCardUser.verificationDetails && (
                      <>
                        <div className="h-px bg-[#1a2b4a]"></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verification Notes</p>
                          <p className="text-sm text-slate-300 font-medium">{selectedCardUser.verificationDetails}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-[#0B1933] px-6 py-4 flex items-center justify-between border-t border-[#1a2b4a]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <i className="ri-check-line text-white text-xs"></i>
                      </div>
                      <p className="text-xs font-bold text-slate-400">Platform Verified</p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">ID: {selectedCardUser.guardId.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628]">
                <button onClick={printCard} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-printer-line text-sm"></i>
                  Print / Save PDF
                </button>
                <button onClick={() => downloadUserCSV(selectedCardUser)} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1a2b4a] hover:bg-[#243452] text-slate-300 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-download-2-line text-sm"></i>
                  Download CSV
                </button>
              </div>
            </div>
          </div>

          <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
            <div className="flex items-center justify-center min-h-screen p-8">
              <div className="bg-white rounded-2xl border-2 border-slate-800 overflow-hidden shadow-none w-full max-w-lg">
                <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                      <i className="ri-shield-check-fill text-2xl text-emerald-400"></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security License</p>
                      <p className="text-white font-bold text-lg leading-tight">SIA Verification Card</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                    <p className={`text-sm font-bold ${selectedCardUser.verificationStatus === 'verified' ? 'text-emerald-400' : selectedCardUser.verificationStatus === 'pending' ? 'text-amber-400' : 'text-red-400'}`}>
                      {selectedCardUser.verificationStatus.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <i className="ri-shield-user-line text-3xl text-slate-400"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License Holder</p>
                      <p className="text-xl font-extrabold text-slate-900">{selectedCardUser.fullName || 'N/A'}</p>
                      <p className="text-sm text-slate-500 font-medium">{selectedCardUser.email}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SIA License Number</p><p className="text-base font-bold text-slate-900 font-mono">{selectedCardUser.siaLicenseNumber || 'N/A'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License Status</p><p className={`text-base font-bold ${getLicenseStatusColor(selectedCardUser.licenseStatus)}`}>{selectedCardUser.licenseStatus ? selectedCardUser.licenseStatus.toUpperCase() : 'N/A'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</p><p className={`text-base font-bold ${isExpiringSoon(selectedCardUser.licenseExpiry) ? 'text-orange-600' : 'text-slate-900'}`}>{formatDate(selectedCardUser.licenseExpiry)}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verified Date</p><p className="text-base font-bold text-slate-900">{formatDate(selectedCardUser.siaVerifiedAt)}</p></div>
                  </div>
                  {selectedCardUser.siaSectors && selectedCardUser.siaSectors.length > 0 && (
                    <>
                      <div className="h-px bg-slate-100"></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Authorized Sectors</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCardUser.siaSectors.map((s, i) => (<span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">{s}</span>))}
                        </div>
                      </div>
                    </>
                  )}
                  {selectedCardUser.verificationDetails && (
                    <>
                      <div className="h-px bg-slate-100"></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verification Notes</p><p className="text-sm text-slate-600 font-medium">{selectedCardUser.verificationDetails}</p></div>
                    </>
                  )}
                </div>
                <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><i className="ri-check-line text-white text-xs"></i></div><p className="text-xs font-bold text-slate-500">Platform Verified</p></div>
                  <p className="text-[10px] text-slate-400 font-medium">ID: {selectedCardUser.guardId.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 flex-shrink-0">
            <i className="ri-error-warning-fill text-xl text-red-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-300 mb-1">Failed to load verifications</h3>
            <p className="text-sm text-red-400/80">{error}</p>
          </div>
          <button
            onClick={() => fetchPage(page, filter, debouncedSearch, sortBy)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20">
            <i className="ri-id-card-line text-xl"></i>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SIA Verifications</h1>
        </div>
        <p className="text-sm text-slate-400 font-medium ml-13">Monitor and manage SIA license verifications across all guards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className={`bg-[#0a1628] rounded-2xl p-5 border ${s.border} hover:border-slate-600 transition-all`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={`${s.icon} ${s.iconColor} text-lg`}></i>
                </div>
              </div>
              <span className="text-3xl font-extrabold text-white">{s.count}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">{s.label}</h3>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-[#0a1628] rounded-2xl border border-[#1a2b4a] p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-5">
          <div className="flex-1 relative">
            <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <i className="ri-search-line text-lg"></i>
            </div>
            <input
              type="text"
              placeholder="Search by name, license number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#1a2b4a] focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm font-medium text-slate-200 placeholder:text-slate-600 bg-[#0B1933] transition-all outline-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                className="appearance-none px-4 py-3 pr-10 rounded-xl border border-[#1a2b4a] focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm font-medium text-slate-300 bg-[#0B1933] transition-all cursor-pointer outline-none"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="expiry">Sort by Expiry</option>
              </select>
              <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <i className="ri-arrow-down-s-line text-base"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', icon: 'ri-list-check', count: null },
            { key: 'pending', label: 'Pending', icon: 'ri-time-line', count: stats.totalPending },
            { key: 'verified', label: 'Verified', icon: 'ri-checkbox-circle-line', count: stats.totalVerified },
            { key: 'rejected', label: 'Rejected', icon: 'ri-close-circle-line', count: stats.totalRejected },
            { key: 'expired', label: 'Expired', icon: 'ri-error-warning-line', count: stats.totalExpired },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key as typeof filter)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filter === tab.key
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-[#1a2b4a] text-slate-400 hover:bg-[#243452] hover:text-slate-300'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={`${tab.icon} text-sm`}></i>
              </div>
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm font-medium">Loading verifications...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-[#0a1628] rounded-2xl border border-[#1a2b4a] p-16 text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-[#1a2b4a] text-slate-600 mx-auto mb-5">
            <i className="ri-file-search-line text-3xl"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">{error ? 'Failed to Load' : 'No Results Found'}</h3>
          <p className="text-sm text-slate-400">{searchTerm ? `No users found matching "${searchTerm}"` : `No ${filter === 'all' ? '' : filter} verifications found`}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {entries.map((entry) => {
              const badge = getStatusBadge(entry.verificationStatus);
              const docs = entry.guardDocs;
              return (
                <div key={entry.guardId} className="bg-[#0a1628] rounded-2xl border border-[#1a2b4a] p-6 hover:border-slate-600 transition-all">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-[#1a2b4a] flex items-center justify-center ring-1 ring-[#1a2b4a] flex-shrink-0 overflow-hidden">
                        {docs?.profile_image_path ? (
                          <ProfileAvatar path={docs.profile_image_path} />
                        ) : (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <i className="ri-shield-user-line text-2xl text-slate-400"></i>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{entry.fullName || 'N/A'}</h3>
                        <p className="text-sm text-slate-400 font-medium">{entry.email}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          License <span className="font-semibold text-slate-300">{entry.siaLicenseNumber}</span>
                          {entry.siaCheckStatus && (
                            <span className="ml-2 text-slate-600">| SIA Check: <span className="text-slate-400">{entry.siaCheckStatus}</span></span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}>
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className={`${badge.icon} text-sm`}></i>
                      </div>
                      {entry.verificationStatus.charAt(0).toUpperCase() + entry.verificationStatus.slice(1)}
                    </span>
                  </div>

                  {hasAnyDocs(docs) && (
                    <div className="mb-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-image-line text-sm"></i>
                        </div>
                        Documents
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {docs?.profile_image_path && (
                          <div className="flex flex-col gap-1">
                            <DocumentThumbnail path={docs.profile_image_path} label="Profile Photo" bucket="guard-profiles" />
                            <span className="text-[10px] text-slate-500 font-medium text-center">Profile</span>
                          </div>
                        )}
                        {docs?.sia_licence_front_path && (
                          <div className="flex flex-col gap-1">
                            <DocumentThumbnail path={docs.sia_licence_front_path} label="SIA Licence Front" bucket="sia-licences" />
                            <span className="text-[10px] text-slate-500 font-medium text-center">SIA Front</span>
                          </div>
                        )}
                        {docs?.sia_licence_back_path && (
                          <div className="flex flex-col gap-1">
                            <DocumentThumbnail path={docs.sia_licence_back_path} label="SIA Licence Back" bucket="sia-licences" />
                            <span className="text-[10px] text-slate-500 font-medium text-center">SIA Back</span>
                        </div>
                        )}
                        {docs?.sia_supporting_document_path && (
                          <div className="flex flex-col gap-1">
                            <DocumentThumbnail path={docs.sia_supporting_document_path} label="Supporting Document" bucket="sia-licences" />
                            <span className="text-[10px] text-slate-500 font-medium text-center">Supporting</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                    <div className="bg-[#0B1933] rounded-xl p-4 ring-1 ring-[#1a2b4a]">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">License Status</h4>
                      <p className={`text-base font-bold ${getLicenseStatusColor(entry.licenseStatus)}`}>{entry.licenseStatus ? entry.licenseStatus.toUpperCase() : 'N/A'}</p>
                    </div>
                    <div className="bg-[#0B1933] rounded-xl p-4 ring-1 ring-[#1a2b4a]">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expiry Date</h4>
                      <p className={`text-base font-bold ${isExpiringSoon(entry.licenseExpiry) ? 'text-orange-400' : 'text-slate-200'}`}>
                        {formatDate(entry.licenseExpiry)}
                        {isExpiringSoon(entry.licenseExpiry) && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-bold ring-1 ring-orange-500/20">
                            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-error-warning-line text-xs"></i></div>
                            Expiring Soon
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-[#0B1933] rounded-xl p-4 ring-1 ring-[#1a2b4a]">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Verified Date</h4>
                      <p className="text-base font-bold text-slate-200">{formatDate(entry.siaVerifiedAt)}</p>
                    </div>
                  </div>

                  {entry.siaSectors && entry.siaSectors.length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Authorized Sectors</h4>
                      <div className="flex flex-wrap gap-2">
                        {entry.siaSectors.map((sector, index) => (
                          <span key={index} className="px-3 py-1.5 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-bold ring-1 ring-sky-500/20">{sector}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.verificationDetails && (
                    <div className="mb-5 bg-teal-500/10 rounded-xl p-4 ring-1 ring-teal-500/20">
                      <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                        <div className="w-4 h-4 flex items-center justify-center"><i className="ri-information-line text-sm text-teal-400"></i></div>
                        Verification Details
                      </h4>
                      <p className="text-sm text-teal-300/80 font-medium">{entry.verificationDetails}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-5 border-t border-[#1a2b4a]">
                    <button
                      onClick={() => handleRetriggerVerification(entry)}
                      disabled={retriggering === entry.guardId}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      {retriggering === entry.guardId ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Processing...</>
                      ) : (
                        <><div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-sm"></i></div>Re-trigger Verification</>
                      )}
                    </button>
                    <button onClick={() => openCard(entry)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a2b4a] text-teal-400 rounded-xl text-sm font-semibold hover:bg-[#243452] transition-all border border-[#1a2b4a] whitespace-nowrap cursor-pointer">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-id-card-line text-sm"></i></div>
                      View Card
                    </button>
                    <button onClick={() => downloadUserCSV(entry)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a2b4a] text-teal-400 rounded-xl text-sm font-semibold hover:bg-[#243452] transition-all border border-[#1a2b4a] whitespace-nowrap cursor-pointer">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-download-2-line text-sm"></i></div>
                      Download CSV
                    </button>
                    <Link href={`mailto:${entry.email}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a2b4a] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#243452] hover:text-slate-300 transition-all whitespace-nowrap cursor-pointer">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-line text-sm"></i></div>
                      Contact User
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-[#0a1628] rounded-2xl border border-[#1a2b4a] overflow-hidden">
            <Pagination
              currentPage={page}
              totalItems={totalCount}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}