'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import { useRouter } from 'next/navigation';

export default function BankSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'bank' | 'preferences' | 'history'>('bank');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [displayName, setDisplayName] = useState('Guard');
  const [initials, setInitials] = useState('G');
  const [connectStatus, setConnectStatus] = useState<{
    connected: boolean;
    stripeAccountId: string | null;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    status: string;
    requirementsDue: string[];
    restrictedReason: string | null;
    lastCheckedAt: string | null;
  } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [statusRefreshLoading, setStatusRefreshLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();

  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    sortCode: '',
    bankName: '',
    accountType: 'personal',
    isDefault: true
  });

  const [payoutPreferences, setPayoutPreferences] = useState({
    payoutFrequency: 'per_job',
    minimumPayout: 50,
    holdPayouts: false,
    instantPayoutEnabled: false
  });

  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_onboarding') === 'return') {
      setToast({ message: 'Stripe setup complete! Your account is being verified.', type: 'success' });
      refreshStripeStatus();
    } else if (params.get('stripe_onboarding') === 'refresh') {
      setToast({ message: 'Please complete your Stripe Express setup to receive payouts.', type: 'warning' });
    }
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/guard/login');
        return;
      }

      const { data: guard } = await supabase
        .from('guards')
        .select('id, full_name, payout_frequency, minimum_payout, hold_payouts, instant_payout_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (guard) {
        setGuardId(guard.id);
        setDisplayName(guard.full_name || 'Guard');
        setInitials(
          (guard.full_name || 'Guard')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
        );

        const { data: bankData } = await supabase
          .from('guard_bank_details')
          .select('account_holder, account_number, sort_code, bank_name, account_type, bank_verified')
          .eq('guard_id', guard.id)
          .maybeSingle();

        if (bankData) {
          setBankDetails({
            accountHolderName: bankData.account_holder || '',
            accountNumber: bankData.account_number || '',
            sortCode: bankData.sort_code || '',
            bankName: bankData.bank_name || '',
            accountType: bankData.account_type || 'personal',
            isDefault: true
          });
          setVerificationStatus(bankData.bank_verified ? 'verified' : 'pending');
        }

        if (guard.payout_frequency) {
          setPayoutPreferences({
            payoutFrequency: guard.payout_frequency || 'per_job',
            minimumPayout: guard.minimum_payout || 50,
            holdPayouts: guard.hold_payouts || false,
            instantPayoutEnabled: guard.instant_payout_enabled || false
          });
        }

        const { data: { session } } = await supabase.auth.getSession();
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guard-stripe-status`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`
              }
            }
          );
          if (res.ok) {
            const status = await res.json();
            setConnectStatus(status);
          } else {
            console.error('get-guard-stripe-status failed:', res.status);
          }
        } catch (err) {
          console.error('Error checking connect status:', err);
        }

        const { data: payouts } = await supabase
          .from('guard_payouts')
          .select('*')
          .eq('guard_id', guard.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setPayoutHistory(payouts || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSortCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const handleSortCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSortCode(e.target.value);
    setBankDetails({ ...bankDetails, sortCode: formatted });
  };

  const handleSave = async () => {
    if (!guardId) return;

    if (!bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.sortCode) {
      alert('Please fill in all required bank details');
      return;
    }

    const sortCodeDigits = bankDetails.sortCode.replace(/\D/g, '');
    if (sortCodeDigits.length !== 6) {
      alert('Please enter a valid 6-digit sort code');
      return;
    }

    if (bankDetails.accountNumber.length < 8) {
      alert('Please enter a valid 8-digit account number');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('guard_bank_details')
        .upsert({
          guard_id: guardId,
          account_holder: bankDetails.accountHolderName,
          account_number: bankDetails.accountNumber,
          sort_code: bankDetails.sortCode.replace(/-/g, ''),
          bank_name: bankDetails.bankName,
          account_type: bankDetails.accountType,
          bank_verified: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guard_id' });

      if (error) throw error;

      await supabase
        .from('guards')
        .update({
          payout_frequency: payoutPreferences.payoutFrequency,
          minimum_payout: payoutPreferences.minimumPayout,
          hold_payouts: payoutPreferences.holdPayouts,
          instant_payout_enabled: payoutPreferences.instantPayoutEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', guardId);

      setVerificationStatus('pending');
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error: any) {
      console.error('Error saving bank details:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankAccount = async () => {
    if (!guardId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('guard_bank_details')
        .delete()
        .eq('guard_id', guardId);

      if (error) throw error;

      setBankDetails({
        accountHolderName: '',
        accountNumber: '',
        sortCode: '',
        bankName: '',
        accountType: 'personal',
        isDefault: true
      });
      setVerificationStatus('pending');
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Error deleting bank account:', error);
      alert(`Failed to delete: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const refreshStripeStatus = async () => {
    setStatusRefreshLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guard-stripe-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      if (res.ok) {
        const status = await res.json();
        setConnectStatus(status);
      }
    } catch (err) {
      console.error('Error refreshing stripe status:', err);
    } finally {
      setStatusRefreshLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnectLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed to connect (${res.status})`);
      }
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (!url) throw new Error('No redirect URL returned from Stripe');
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to connect bank account', type: 'error' });
    } finally {
      setConnectLoading(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setConnectLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed (${res.status})`);
      }
      const { url } = await res.json();
      if (!url) throw new Error('No URL returned');
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to open onboarding', type: 'error' });
    } finally {
      setConnectLoading(false);
    }
  };

  const handleStripeDashboard = async () => {
    setDashboardLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-dashboard-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed (${res.status})`);
      }
      const { url } = await res.json();
      if (!url) throw new Error('No URL returned');
      window.open(url, '_blank');
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to open Stripe dashboard', type: 'error' });
    } finally {
      setDashboardLoading(false);
    }
  };

  const maskAccountNumber = (num: string) => {
    if (!num || num.length < 4) return num;
    return '****' + num.slice(-4);
  };

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex">
        <PortalSidebar
          role="guard"
          displayName={displayName}
          subtitle="Guard"
          initials={initials}
        />
        <main className="flex-1 ml-72 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading bank settings...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar
        role="guard"
        displayName={displayName}
        subtitle="Guard"
        initials={initials}
      />
      <main className="flex-1 ml-72 pt-20">
        <div className="bg-white dark:bg-gradient-to-br dark:from-[#162036] dark:to-[#0B1933] py-12 border-b border-slate-200 dark:border-[#1e2d4d]">
          <div className="max-w-5xl mx-auto px-6">
            <Link
              href="/guard/earnings"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-medium mb-4 inline-flex items-center cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-line mr-2"></i>Back to Earnings
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-3">Bank Account Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your payout details and preferences</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {showSuccessMessage && (
            <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-xl"></i>
              </div>
              <div>
                <p className="font-semibold text-emerald-300">Bank details saved successfully!</p>
                <p className="text-sm text-emerald-400">Your account will be verified within 1-2 business days.</p>
              </div>
            </div>
          )}

          {toast && (
            <div className={`mb-6 border rounded-xl p-4 flex items-center gap-3 animate-fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/15'
                  : toast.type === 'error'
                  ? 'bg-red-500/15'
                  : 'bg-amber-500/15'
              }`}>
                <i className={`text-xl ${
                  toast.type === 'success'
                    ? 'ri-checkbox-circle-fill text-emerald-400'
                    : toast.type === 'error'
                    ? 'ri-error-warning-fill text-red-400'
                    : 'ri-alert-fill text-amber-400'
                }`} />
              </div>
              <div>
                <p className={`font-semibold ${
                  toast.type === 'success'
                    ? 'text-emerald-300'
                    : toast.type === 'error'
                    ? 'text-red-300'
                    : 'text-amber-300'
                }`}>{toast.message}</p>
              </div>
              <button onClick={() => setToast(null)} className="ml-auto text-slate-400 hover:text-white cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-6 bg-white dark:bg-[#111d35] rounded-xl p-1.5 border border-slate-200 dark:border-[#1e2d4d]">
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'bank'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-400 hover:bg-[#162036]'
              }`}
            >
              <i className="ri-bank-line"></i>
              Bank Details
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'preferences'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-400 hover:bg-[#162036]'
              }`}
            >
              <i className="ri-settings-3-line"></i>
              Payout Preferences
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-400 hover:bg-[#162036]'
              }`}
            >
              <i className="ri-history-line"></i>
              Payout History
            </button>
          </div>

          {activeTab === 'bank' && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-xl text-amber-400"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-300 mb-1">Your Tax Responsibility</h3>
                    <p className="text-sm text-amber-200/80 leading-relaxed">
                      You work as an independent contractor through QuickGuard, not as an employee.
                      You are responsible for declaring your earnings to HMRC, paying Income Tax,
                      National Insurance contributions, and VAT if applicable. QuickGuard does not
                      deduct PAYE or tax from your payouts. Keep all receipts and records for your
                      self-assessment tax return.
                    </p>
                    <p className="text-xs text-amber-400/70 mt-2">
                      Not sure about your tax obligations? Visit <a href="https://www.gov.uk/self-assessment" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">gov.uk/self-assessment</a> or speak to an accountant.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Stripe Payout Account
                    </h3>
                    <p className="text-sm text-slate-400">
                      Connect your bank account via Stripe Express to receive payouts for completed jobs.
                    </p>
                  </div>
                  <button
                    onClick={refreshStripeStatus}
                    disabled={statusRefreshLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#162036] rounded-lg border border-[#1e2d4d] hover:border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <div className={`w-3 h-3 flex items-center justify-center ${statusRefreshLoading ? 'animate-spin' : ''}`}>
                      <i className="ri-refresh-line"></i>
                    </div>
                    Refresh
                  </button>
                </div>

                {!connectStatus?.connected && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 p-4 bg-slate-500/5 rounded-xl border border-slate-500/15">
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-error-warning-line text-slate-400 text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-300">Not Started</p>
                        <p className="text-xs text-slate-500">Set up your Stripe Express account to start receiving payouts</p>
                      </div>
                    </div>
                    <button onClick={handleConnectStripe} disabled={connectLoading}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-bank-card-line"></i>
                      </div>
                      {connectLoading ? 'Redirecting...' : 'Set Up Payouts'}
                    </button>
                  </div>
                )}

                {connectStatus?.connected && connectStatus.status === 'not_started' && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 p-4 bg-slate-500/5 rounded-xl border border-slate-500/15">
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-time-line text-slate-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-300">Setup Incomplete</p>
                        <p className="text-xs text-slate-500">Complete your Stripe Express onboarding to receive payouts.</p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-500/15 text-slate-400 border border-slate-500/25 rounded-lg text-xs font-medium whitespace-nowrap">
                        Not Started
                      </span>
                    </div>
                    <button onClick={handleContinueOnboarding} disabled={connectLoading}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-play-circle-line"></i>
                      </div>
                      {connectLoading ? 'Redirecting...' : 'Continue Onboarding'}
                    </button>
                  </div>
                )}

                {connectStatus?.connected && connectStatus.status === 'pending' && (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-amber-500/5 rounded-xl border border-amber-500/15">
                      <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-time-line text-amber-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-amber-300">Pending Verification</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg text-xs font-medium whitespace-nowrap">
                            Pending
                          </span>
                        </div>
                        <p className="text-xs text-amber-400/80">Stripe is reviewing your account. This usually takes 1-2 business days.</p>
                        {connectStatus.requirementsDue && connectStatus.requirementsDue.length > 0 && (
                          <div className="mt-3 bg-amber-500/5 rounded-lg p-3 border border-amber-500/10">
                            <p className="text-xs font-medium text-amber-400 mb-1.5">Still needed:</p>
                            <ul className="space-y-1">
                              {connectStatus.requirementsDue.map((req: string, i: number) => (
                                <li key={i} className="text-xs text-amber-300/80 flex items-center gap-1.5">
                                  <i className="ri-error-warning-line text-amber-400"></i>
                                  {req.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleContinueOnboarding} disabled={connectLoading}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-play-circle-line"></i>
                        </div>
                        {connectLoading ? 'Redirecting...' : 'Continue Onboarding'}
                      </button>
                      <button onClick={refreshStripeStatus} disabled={statusRefreshLoading}
                        className="flex items-center gap-2 px-4 py-3 bg-[#162036] text-slate-300 border border-[#1e2d4d] rounded-xl text-sm font-medium hover:bg-[#1a2642] disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-refresh-line"></i>
                        </div>
                        Check Status
                      </button>
                    </div>
                  </div>
                )}

                {connectStatus?.connected && connectStatus.status === 'restricted' && (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-red-500/5 rounded-xl border border-red-500/15">
                      <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-error-warning-line text-red-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-red-300">Restricted / Action Required</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-xs font-medium whitespace-nowrap">
                            Restricted
                          </span>
                        </div>
                        <p className="text-xs text-red-400/80">
                          {connectStatus.restrictedReason
                            ? connectStatus.restrictedReason.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                            : 'Your account needs more information before you can receive payouts.'}
                        </p>
                        {connectStatus.requirementsDue && connectStatus.requirementsDue.length > 0 && (
                          <div className="mt-3 bg-red-500/5 rounded-lg p-3 border border-red-500/10">
                            <p className="text-xs font-medium text-red-400 mb-1.5">Requirements due:</p>
                            <ul className="space-y-1">
                              {connectStatus.requirementsDue.map((req: string, i: number) => (
                                <li key={i} className="text-xs text-red-300/80 flex items-center gap-1.5">
                                  <i className="ri-error-warning-line text-red-400"></i>
                                  {req.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={handleContinueOnboarding} disabled={connectLoading}
                      className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-tools-line"></i>
                      </div>
                      {connectLoading ? 'Redirecting...' : 'Fix Account'}
                    </button>
                  </div>
                )}

                {connectStatus?.connected && connectStatus.status === 'ready' && (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/15">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-check-line text-emerald-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-emerald-300">Ready for Payouts</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-medium whitespace-nowrap">
                            <i className="ri-shield-check-line"></i>
                            Ready
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400/80">Your Stripe account is fully set up and ready to receive payouts.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleStripeDashboard} disabled={dashboardLoading}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-bank-card-line"></i>
                        </div>
                        {dashboardLoading ? 'Loading...' : 'Update Bank Details'}
                      </button>
                      <button onClick={refreshStripeStatus} disabled={statusRefreshLoading}
                        className="flex items-center gap-2 px-4 py-3 bg-[#162036] text-slate-300 border border-[#1e2d4d] rounded-xl text-sm font-medium hover:bg-[#1a2642] disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-refresh-line"></i>
                        </div>
                        Refresh
                      </button>
                    </div>
                  </div>
                )}

                {connectStatus?.connected && (
                  <div className="mt-5 pt-4 border-t border-[#1e2d4d]">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Account Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {connectStatus.stripeAccountId && (
                        <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Account ID</p>
                          <p className="text-xs font-mono text-slate-300">
                            {connectStatus.stripeAccountId.slice(0, 4)}&bull;&bull;&bull;{connectStatus.stripeAccountId.slice(-4)}
                          </p>
                        </div>
                      )}
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Details Submitted</p>
                        <p className={`text-xs font-semibold ${connectStatus.detailsSubmitted ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {connectStatus.detailsSubmitted ? (
                            <span className="flex items-center gap-1"><i className="ri-check-line"></i>Yes</span>
                          ) : (
                            <span className="flex items-center gap-1"><i className="ri-close-line"></i>No</span>
                          )}
                        </p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Charges Enabled</p>
                        <p className={`text-xs font-semibold ${connectStatus.chargesEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {connectStatus.chargesEnabled ? (
                            <span className="flex items-center gap-1"><i className="ri-check-line"></i>Yes</span>
                          ) : (
                            <span className="flex items-center gap-1"><i className="ri-close-line"></i>No</span>
                          )}
                        </p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Payouts Enabled</p>
                        <p className={`text-xs font-semibold ${connectStatus.payoutsEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {connectStatus.payoutsEnabled ? (
                            <span className="flex items-center gap-1"><i className="ri-check-line"></i>Yes</span>
                          ) : (
                            <span className="flex items-center gap-1"><i className="ri-close-line"></i>No</span>
                          )}
                        </p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
                        <p className={`text-xs font-semibold capitalize ${
                          connectStatus.status === 'ready' ? 'text-emerald-400' :
                          connectStatus.status === 'pending' ? 'text-amber-400' :
                          connectStatus.status === 'restricted' ? 'text-red-400' :
                          'text-slate-400'
                        }`}>
                          {connectStatus.status === 'ready' ? (
                            <span className="flex items-center gap-1"><i className="ri-shield-check-line"></i>Ready</span>
                          ) : connectStatus.status === 'pending' ? (
                            <span className="flex items-center gap-1"><i className="ri-time-line"></i>Pending</span>
                          ) : connectStatus.status === 'restricted' ? (
                            <span className="flex items-center gap-1"><i className="ri-error-warning-line"></i>Restricted</span>
                          ) : (
                            connectStatus.status
                          )}
                        </p>
                      </div>
                      {connectStatus.lastCheckedAt && (
                        <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Last Checked</p>
                          <p className="text-xs text-slate-400">
                            {new Date(connectStatus.lastCheckedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center">
                      <i className="ri-bank-card-line text-2xl text-teal-400"></i>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bank Account Details</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Enter your UK bank account for payouts</p>
                    </div>
                  </div>
                  {bankDetails.accountNumber && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      verificationStatus === 'verified'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : verificationStatus === 'failed'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}>
                      <i className={`${
                        verificationStatus === 'verified'
                          ? 'ri-checkbox-circle-fill'
                          : verificationStatus === 'failed'
                          ? 'ri-error-warning-fill'
                          : 'ri-time-line'
                      }`}></i>
                      {verificationStatus === 'verified' ? 'Verified' : verificationStatus === 'failed' ? 'Verification Failed' : 'Pending Verification'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankDetails.accountHolderName}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                      placeholder="Enter the name on your bank account"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Must match the name on your bank account exactly</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Sort Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankDetails.sortCode}
                      onChange={handleSortCodeChange}
                      placeholder="00-00-00"
                      maxLength={8}
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAccountNumber ? 'text' : 'password'}
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                        placeholder="12345678"
                        maxLength={8}
                        className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-mono text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                      >
                        <i className={showAccountNumber ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                      placeholder="e.g., Barclays, HSBC, Lloyds"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Account Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="accountType"
                          value="personal"
                          checked={bankDetails.accountType === 'personal'}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountType: e.target.value })}
                          className="w-4 h-4 text-teal-500"
                        />
                        <span className="text-slate-700 dark:text-slate-300">Personal</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="accountType"
                          value="business"
                          checked={bankDetails.accountType === 'business'}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountType: e.target.value })}
                          className="w-4 h-4 text-teal-500"
                        />
                        <span className="text-slate-700 dark:text-slate-300">Business</span>
                      </label>
                    </div>
                  </div>
                </div>

                {bankDetails.accountNumber && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#1e2d4d]">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="text-red-400 hover:text-red-300 font-medium text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-line"></i>
                      Remove Bank Account
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-shield-check-line text-xl text-teal-400"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Your information is secure</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      We use bank-level encryption to protect your financial information. Your account details are never shared with third parties and are only used to process your payouts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-500/15 rounded-xl flex items-center justify-center">
                    <i className="ri-settings-3-line text-2xl text-green-400"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Payout Preferences</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Customize how and when you receive payments</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Payout Frequency
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { value: 'per_job', label: 'Per Job', desc: 'Receive payout after each completed job', icon: 'ri-briefcase-line' },
                        { value: 'weekly', label: 'Weekly', desc: 'Consolidated weekly payouts every Friday', icon: 'ri-calendar-line' },
                        { value: 'monthly', label: 'Monthly', desc: 'Monthly payouts on the 1st of each month', icon: 'ri-calendar-2-line' }
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            payoutPreferences.payoutFrequency === option.value
                              ? 'border-teal-500 bg-teal-500/5'
                              : 'border-[#1e2d4d] hover:border-[#1e2d4d]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="payoutFrequency"
                            value={option.value}
                            checked={payoutPreferences.payoutFrequency === option.value}
                            onChange={(e) => setPayoutPreferences({ ...payoutPreferences, payoutFrequency: e.target.value })}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2 mb-2">
                            <i className={`${option.icon} text-lg ${payoutPreferences.payoutFrequency === option.value ? 'text-teal-400' : 'text-slate-500'}`}></i>
                            <span className="font-semibold text-slate-900 dark:text-white">{option.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</p>
                          {payoutPreferences.payoutFrequency === option.value && (
                            <div className="absolute top-3 right-3">
                              <i className="ri-checkbox-circle-fill text-teal-500"></i>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                      Minimum Payout Amount
                    </label>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-white">£</span>
                      <input
                        type="number"
                        min="10"
                        max="500"
                        step="10"
                        value={payoutPreferences.minimumPayout}
                        onChange={(e) => setPayoutPreferences({ ...payoutPreferences, minimumPayout: parseInt(e.target.value) })}
                        className="w-32 px-4 py-3 bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      Payouts below this amount will be held until the threshold is reached
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#1e2d4d]">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0B1933] rounded-xl border border-slate-200 dark:border-[#1e2d4d]">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Hold All Payouts</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Temporarily pause all payouts to your account</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payoutPreferences.holdPayouts}
                          onChange={(e) => setPayoutPreferences({ ...payoutPreferences, holdPayouts: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0B1933] rounded-xl border border-purple-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center">
                        <i className="ri-flashlight-line text-xl text-purple-400"></i>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white">Instant Payouts</h3>
                          <span className="px-2 py-0.5 bg-purple-500/15 text-purple-400 text-xs font-medium rounded-full border border-purple-500/25">Coming Soon</span>
                        </div>
                        <p className="text-sm text-slate-400">Get paid within minutes for a small fee</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-not-allowed opacity-50">
                      <input
                        type="checkbox"
                        checked={payoutPreferences.instantPayoutEnabled}
                        disabled
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] overflow-hidden">
              <div className="p-6 border-b border-[#1e2d4d]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center">
                    <i className="ri-history-line text-2xl text-amber-400"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Recent Payouts</h2>
                    <p className="text-sm text-slate-400">Your last 10 payout transactions</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-4 mx-6 mt-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-full flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-amber-400"></i>
                  </div>
                  <div>
                    <p className="font-semibold text-amber-300 text-sm mb-1">Tax Reminder</p>
                    <p className="text-sm text-amber-200/80 leading-relaxed">
                      All payouts shown here are gross amounts — QuickGuard does not deduct Income Tax,
                      National Insurance, or VAT. You must declare these earnings to HMRC and keep
                      these records for your self-assessment. Download receipts for each payout to stay organised.
                    </p>
                  </div>
                </div>
              </div>

              {payoutHistory.length > 0 ? (
                <div className="divide-y divide-[#1e2d4d] mt-4">
                  {payoutHistory.map((payout, index) => (
                    <div key={payout.id || index} className="p-4 hover:bg-[#162036] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            payout.status === 'paid' || payout.status === 'completed'
                              ? 'bg-emerald-500/15'
                              : payout.status === 'processing' || payout.status === 'initiated'
                              ? 'bg-blue-500/15'
                              : payout.status === 'failed' || payout.status === 'held'
                              ? 'bg-red-500/15'
                              : 'bg-amber-500/15'
                          }`}>
                            <i className={`${
                              payout.status === 'paid' || payout.status === 'completed'
                                ? 'ri-checkbox-circle-fill text-emerald-400'
                                : payout.status === 'processing' || payout.status === 'initiated'
                                ? 'ri-loader-4-line text-blue-400 animate-spin'
                                : payout.status === 'failed' || payout.status === 'held'
                                ? 'ri-error-warning-fill text-red-400'
                                : 'ri-time-line text-amber-400'
                            }`}></i>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {payout.reference_number || `PO-${(payout.id || '').toString().slice(0, 8).toUpperCase()}`}
                            </p>
                            <p className="text-sm text-slate-400">
                              {new Date(payout.created_at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-white">£{(payout.net_amount || payout.amount || 0).toFixed(2)}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            payout.status === 'paid' || payout.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : payout.status === 'processing' || payout.status === 'initiated'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                              : payout.status === 'failed' || payout.status === 'held'
                              ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                          }`}>
                            {payout.status?.charAt(0).toUpperCase() + payout.status?.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-wallet-3-line text-3xl text-slate-400 dark:text-slate-500"></i>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">No payouts yet</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your payout history will appear here once you complete jobs</p>
                </div>
              )}

              {payoutHistory.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-[#0B1933] border-t border-slate-200 dark:border-[#1e2d4d]">
                  <Link
                    href="/guard/earnings"
                    className="text-teal-400 hover:text-teal-300 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    View all earnings
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'bank' || activeTab === 'preferences') && (
            <div className="flex gap-4 mt-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-teal-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Save Changes
                  </>
                )}
              </button>
              <Link
                href="/guard/earnings"
                className="px-8 py-4 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap flex items-center justify-center"
              >
                Cancel
              </Link>
            </div>
          )}
        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111d35] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-[#1e2d4d]">
            <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-3xl text-red-400"></i>
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Remove Bank Account?</h3>
            <p className="text-slate-400 text-center mb-6">
              This will remove your bank account details. You won't be able to receive payouts until you add a new account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBankAccount}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {saving ? 'Removing...' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
