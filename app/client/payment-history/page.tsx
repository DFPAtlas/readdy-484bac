'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import InvoicePreview from '../jobs/[id]/payment/InvoicePreview';
import { useClientGuard } from '@/hooks/useClientGuard';
import SearchFilterBar from '../components/SearchFilterBar';

interface InvoiceJob {
  id: string;
  job_title: string;
  security_type: string;
  venue_name: string;
  venue_address_line1: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
}

interface InvoiceClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

interface InvoiceGuard {
  id: string;
  full_name: string;
  hours_worked?: number;
}

interface InvoiceCosts {
  hours?: number;
  guardFees: number;
  serviceFee: number;
  vat: number;
  total: number;
}

const PAYMENT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest Amount' },
  { value: 'payment_required', label: 'Payment Required First' },
];

const PAYMENT_FILTER_CONFIGS = [
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'succeeded', label: 'Paid' },
      { value: 'completed', label: 'Completed' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed' },
      { value: 'refunded', label: 'Refunded' },
      { value: 'disputed', label: 'Disputed' },
    ],
  },
  {
    key: 'date',
    label: 'Date Range',
    type: 'dateRange' as const,
  },
  {
    key: 'amount',
    label: 'Amount',
    type: 'select' as const,
    options: [
      { value: 'under_50', label: 'Under £50' },
      { value: '50_100', label: '£50 - £100' },
      { value: '100_500', label: '£100 - £500' },
      { value: 'over_500', label: 'Over £500' },
    ],
  },
];

export default function ClientPaymentHistoryPage() {
  const router = useRouter();
  const [subscriptionPayments, setSubscriptionPayments] = useState<any[]>([]);
  const [jobPayments, setJobPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { loading: authLoading, allowed } = useClientGuard();
  const [activeTab, setActiveTab] = useState<'subscription' | 'jobs'>('subscription');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [amountFilter, setAmountFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{
    job: InvoiceJob;
    client: InvoiceClient;
    guards: InvoiceGuard[];
    costs: InvoiceCosts;
    invoiceNumber: string;
  } | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailToast, setEmailToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Free');
  const [initials, setInitials] = useState('CL');

  useEffect(() => {
    fetchUserAndPayments();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channels: any[] = [];

    const subChannel = supabase
      .channel(`payment-history-sub-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscription_payments',
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchSubscriptionPayments(userId);
      })
      .subscribe();
    channels.push(subChannel);

    const txChannel = supabase
      .channel(`payment-history-tx-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        // NOTE: transactions.client_id is the client record ID, not auth.uid()
        // RLS enforces ownership at query time; realtime fires for all but data is filtered on fetch
      }, () => {
        fetchJobPayments(userId);
      })
      .subscribe();
    channels.push(txChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [userId]);

  const fetchUserAndPayments = async () => {
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: client } = await supabase
        .from('clients')
        .select('company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (client) {
        setCompanyName(client.company_name || 'Client');
        setSubscriptionTier(client.subscription_tier || 'Free');
        const parts = (client.company_name || 'Client').trim().split(' ');
        if (parts.length >= 2) {
          setInitials(`${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase());
        } else {
          setInitials((client.company_name || 'Client').slice(0, 2).toUpperCase());
        }
      }

      await Promise.all([
        fetchSubscriptionPayments(user.id),
        fetchJobPayments(user.id)
      ]);
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionPayments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptionPayments(data || []);
    } catch (error) {
      console.error('Error fetching subscription payments:', error);
    }
  };

  const fetchJobPayments = async (userId: string) => {
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!clientData) return;

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!transactions || transactions.length === 0) {
        setJobPayments([]);
        return;
      }

      const jobIds = transactions.map(t => t.job_id).filter(Boolean);
      let jobsMap: Record<string, any> = {};
      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, job_title, venue_city, start_date, start_time, end_time')
          .in('id', jobIds);

        if (jobsData) {
          jobsMap = Object.fromEntries(jobsData.map(j => [j.id, j]));
        }
      }

      const merged = transactions.map(t => ({
        ...t,
        jobs: jobsMap[t.job_id] || null,
      }));

      setJobPayments(merged);
    } catch (error) {
      console.error('Error fetching job payments:', error);
    }
  };

  const calculateHours = (startTime: string, endTime: string, startDate: string, endDate: string | null) => {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate || startDate}T${endTime}`);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    const startD = new Date(startDate);
    const endD = new Date(endDate || startDate);
    const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return hours * days;
  };

  const handleDownloadInvoice = useCallback(async (transaction: any) => {
    if (!transaction.job_id && !transaction.jobs?.id) return;
    const jobId = transaction.job_id || transaction.jobs?.id;

    setInvoiceLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData) return;

      const { data: jobData } = await supabase
        .from('jobs')
        .select(`
          *,
          job_assignments!inner (
            id,
            guard_id,
            guards (
              id,
              full_name
            )
          )
        `)
        .eq('id', jobId)
        .eq('client_id', clientData.id)
        .maybeSingle();

      if (!jobData) return;

      const hours = calculateHours(jobData.start_time, jobData.end_time, jobData.start_date, jobData.end_date);
      const guardFees = hours * jobData.hourly_rate * jobData.number_of_guards;
      const serviceFee = guardFees * 0.10;
      const subtotal = guardFees + serviceFee;
      const vat = subtotal * 0.20;
      const total = subtotal + vat;

      const guards: InvoiceGuard[] = jobData.job_assignments?.map((a: any) => ({
        id: a.guards?.id || '',
        full_name: a.guards?.full_name || 'Guard',
        hours_worked: hours
      })) || [];

      const job: InvoiceJob = {
        id: jobData.id,
        job_title: jobData.job_title || jobData.title || 'Job',
        security_type: jobData.security_type || 'Security',
        venue_name: jobData.venue_name || 'N/A',
        venue_address_line1: jobData.venue_address_line1 || '',
        venue_city: jobData.venue_city || '',
        venue_postcode: jobData.venue_postcode || '',
        start_date: jobData.start_date,
        end_date: jobData.end_date || jobData.start_date,
        start_time: jobData.start_time,
        end_time: jobData.end_time,
        number_of_guards: jobData.number_of_guards || 1,
        hourly_rate: jobData.hourly_rate || 0
      };

      const client: InvoiceClient = {
        id: clientData.id,
        company_name: clientData.company_name || '',
        contact_name: clientData.contact_name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || '',
        city: clientData.city || '',
        postcode: clientData.postcode || ''
      };

      const costs: InvoiceCosts = {
        hours,
        guardFees: Math.round(guardFees * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100,
        vat: Math.round(vat * 100) / 100,
        total: Math.round(total * 100) / 100
      };

      const invoiceNumber = transaction.invoice_number || `INV-${new Date(transaction.created_at).getFullYear()}${String(new Date(transaction.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(transaction.created_at).getDate()).padStart(2, '0')}-${job.id.slice(0, 6).toUpperCase()}`;

      setInvoiceData({ job, client, guards, costs, invoiceNumber });
      setShowInvoicePreview(true);
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  const handleSendInvoiceEmail = useCallback(async (transaction: any) => {
    if (!transaction.job_id && !transaction.jobs?.id) return;
    const jobId = transaction.job_id || transaction.jobs?.id;

    setEmailSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from('clients')
        .select('email, contact_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const recipientEmail = clientData?.email || user.email;
      if (!recipientEmail) {
        setEmailToast({ message: 'No email found for this account', type: 'error' });
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invoice-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            job_id: jobId,
            recipient_email: recipientEmail,
            recipient_name: clientData?.contact_name || '',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send invoice email');

      setEmailToast({ message: 'Invoice sent to your email!', type: 'success' });
      setTimeout(() => setEmailToast(null), 4000);
    } catch (error) {
      console.error('Error sending invoice email:', error);
      setEmailToast({ message: 'Failed to send invoice email. Please try again.', type: 'error' });
      setTimeout(() => setEmailToast(null), 4000);
    } finally {
      setEmailSending(false);
    }
  }, []);

  const handleRetryPayment = useCallback(async (transaction: any) => {
    if (!transaction.job_id) return;
    const jobId = transaction.job_id;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ jobId }),
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Failed to create payment session');
      }
    } catch (error) {
      console.error('Retry payment error:', error);
      setEmailToast({ message: 'Retry failed. Please try again or contact support.', type: 'error' });
      setTimeout(() => setEmailToast(null), 4000);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
      case 'paid':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'pending':
      case 'pending_payment':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'processing':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border border-red-500/25';
      case 'refunded':
        return 'bg-violet-500/10 text-violet-400 border border-violet-500/25';
      case 'disputed':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/25';
      case 'invoice_sent':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/25';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
      case 'paid':
        return 'Paid';
      case 'pending':
      case 'pending_payment':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      case 'refunded':
        return 'Refunded';
      case 'disputed':
        return 'Disputed';
      case 'invoice_sent':
        return 'Invoice Sent';
      default:
        return status?.toUpperCase() || 'Unknown';
    }
  };

  const currentPayments = activeTab === 'subscription' ? subscriptionPayments : jobPayments;
  
  const filteredPayments = currentPayments.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    let matchesSearch = false;
    if (activeTab === 'subscription') {
      matchesSearch = payment.stripe_invoice_id?.toLowerCase().includes(searchLower) ||
             payment.id.toLowerCase().includes(searchLower) ||
             payment.billing_reason?.toLowerCase().includes(searchLower);
    } else {
      matchesSearch = payment.description?.toLowerCase().includes(searchLower) ||
             payment.jobs?.job_title?.toLowerCase().includes(searchLower) ||
             payment.id.toLowerCase().includes(searchLower);
    }

    if (!matchesSearch) return false;

    if (paymentStatusFilter !== 'all' && payment.status !== paymentStatusFilter) return false;

    if (amountFilter !== 'all') {
      const amount = parseFloat(payment.amount) || 0;
      if (amountFilter === 'under_50' && amount >= 50) return false;
      if (amountFilter === '50_100' && (amount < 50 || amount >= 100)) return false;
      if (amountFilter === '100_500' && (amount < 100 || amount >= 500)) return false;
      if (amountFilter === 'over_500' && amount < 500) return false;
    }

    if (dateFrom && payment.created_at && payment.created_at < dateFrom) return false;
    if (dateTo && payment.created_at && payment.created_at > dateTo + 'T23:59:59') return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'highest') return parseFloat(b.amount) - parseFloat(a.amount);
    if (sortBy === 'payment_required') {
      const aNeeds = a.status === 'pending' || a.status === 'failed' ? 1 : 0;
      const bNeeds = b.status === 'pending' || b.status === 'failed' ? 1 : 0;
      return bNeeds - aNeeds;
    }
    return 0;
  });

  const subTotalSpent = subscriptionPayments
    .filter(p => p.status === 'succeeded' && !p.refunded)
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const jobTotalSpent = jobPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const totalRefunded = subscriptionPayments
    .filter(p => p.refunded)
    .reduce((sum, p) => sum + parseFloat(p.refund_amount || 0), 0);

  const failedPayments = subscriptionPayments.filter(p => p.status === 'failed').length;

  const handleClearFilters = () => {
    setSearchTerm('');
    setPaymentStatusFilter('all');
    setAmountFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('');
    setShowFilters(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setPaymentStatusFilter(value);
    else if (key === 'amount') setAmountFilter(value);
    else if (key === 'date_from') setDateFrom(value);
    else if (key === 'date_to') setDateTo(value);
  };

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          {/* Header Skeleton */}
          <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
            <div className="space-y-1">
              <div className="h-3 w-28 bg-[#162036] rounded animate-pulse"></div>
              <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#162036] rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-8 sm:h-9 w-24 sm:w-32 bg-[#162036] rounded-xl animate-pulse"></div>
              <div className="h-8 sm:h-9 w-32 sm:w-36 bg-teal-500/20 rounded-xl animate-pulse"></div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-8 py-4 sm:py-8">
            {/* Summary Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#162036] rounded-lg animate-pulse"></div>
                    <div className="h-3 w-24 sm:w-28 bg-[#162036] rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 sm:h-10 w-20 sm:w-24 bg-[#162036] rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-28 sm:w-32 bg-[#162036] rounded animate-pulse"></div>
                </div>
              ))}
            </div>

            {/* Tabs + Search Filter Skeleton */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center mb-3 sm:mb-0">
                <div className="flex gap-2">
                  <div className="h-9 sm:h-10 w-36 sm:w-40 bg-teal-500/20 rounded-lg animate-pulse"></div>
                  <div className="h-9 sm:h-10 w-28 sm:w-32 bg-[#162036] rounded-lg animate-pulse"></div>
                </div>
                <div className="flex-1 w-full h-10 bg-[#162036] rounded-xl animate-pulse"></div>
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
              {/* Table Header Skeleton */}
              <div className="hidden sm:grid grid-cols-5 gap-4 px-4 sm:px-6 py-3 sm:py-4 bg-[#162036] border-b border-[#1e2d4d]">
                <div className="h-3 w-20 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-14 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-12 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-14 bg-[#162036] rounded animate-pulse"></div>
              </div>

              {/* Mobile Header */}
              <div className="sm:hidden px-4 py-3 bg-[#162036] border-b border-[#1e2d4d] flex items-center justify-between">
                <div className="h-3 w-24 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-[#162036] rounded animate-pulse"></div>
              </div>

              {/* Table Rows Skeleton */}
              <div className="divide-y divide-[#1e2d4d]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 sm:px-6 py-3 sm:py-4">
                    {/* Desktop Row */}
                    <div className="hidden sm:grid grid-cols-5 gap-4 items-center">
                      <div className="space-y-2">
                        <div className="h-4 w-28 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-3 w-20 bg-[#162036] rounded animate-pulse"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-4 w-20 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-3 w-14 bg-[#162036] rounded animate-pulse"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-5 w-16 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-3 w-10 bg-[#162036] rounded animate-pulse"></div>
                      </div>
                      <div className="h-6 w-16 bg-[#162036] rounded-full animate-pulse"></div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-14 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-4 w-14 bg-[#162036] rounded animate-pulse"></div>
                      </div>
                    </div>
                    {/* Mobile Card */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="h-4 w-32 bg-[#162036] rounded animate-pulse"></div>
                          <div className="h-3 w-24 bg-[#162036] rounded animate-pulse"></div>
                        </div>
                        <div className="h-6 w-16 bg-[#162036] rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="h-4 w-16 bg-[#162036] rounded animate-pulse"></div>
                          <div className="h-3 w-20 bg-[#162036] rounded animate-pulse"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-12 bg-[#162036] rounded animate-pulse"></div>
                          <div className="h-4 w-12 bg-[#162036] rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-white dark:bg-[#111d35] border-b border-slate-200 dark:border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Payment History</h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <Link
              href="/client/dashboard"
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-dashboard-line"></i>
              Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          <div className="mb-8">
            <p className="text-slate-400 dark:text-slate-500 mt-2">View and manage all your subscription and job payments</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-6 text-white border border-emerald-500/25">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/20 rounded-lg">
                  <i className="ri-vip-crown-line text-xl text-emerald-400"></i>
                </div>
                <span className="text-sm font-medium text-emerald-400">Subscription Spent</span>
              </div>
              <div className="text-3xl font-bold text-white">£{subTotalSpent.toFixed(2)}</div>
              <p className="text-sm text-slate-400 mt-2">{subscriptionPayments.filter(p => p.status === 'succeeded').length} payments</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-xl p-6 text-white border border-blue-500/25">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center bg-blue-500/20 rounded-lg">
                  <i className="ri-briefcase-line text-xl text-blue-400"></i>
                </div>
                <span className="text-sm font-medium text-blue-400">Job Payments</span>
              </div>
              <div className="text-3xl font-bold text-white">£{jobTotalSpent.toFixed(2)}</div>
              <p className="text-sm text-slate-400 mt-2">{jobPayments.filter(p => p.status === 'completed').length} transactions</p>
            </div>

            <div className="bg-gradient-to-br from-violet-500/20 to-pink-600/20 rounded-xl p-6 text-white border border-violet-500/25">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center bg-violet-500/20 rounded-lg">
                  <i className="ri-refund-line text-xl text-violet-400"></i>
                </div>
                <span className="text-sm font-medium text-violet-400">Refunded</span>
              </div>
              <div className="text-3xl font-bold text-white">£{totalRefunded.toFixed(2)}</div>
              <p className="text-sm text-slate-400 mt-2">{subscriptionPayments.filter(p => p.refunded).length} refunds</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl p-6 text-white border border-orange-500/25">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center bg-orange-500/20 rounded-lg">
                  <i className="ri-error-warning-line text-xl text-orange-400"></i>
                </div>
                <span className="text-sm font-medium text-orange-400">Failed</span>
              </div>
              <div className="text-3xl font-bold text-white">{failedPayments}</div>
              <p className="text-sm text-slate-400 mt-2">Requires attention</p>
            </div>
          </div>

          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors ${
                    activeTab === 'subscription' 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-[#162036] text-slate-300 hover:bg-[#1a2642] border border-[#1e2d4d]'
                  }`}
                >
                  <i className="ri-vip-crown-line mr-2"></i>
                  Subscription Payments
                </button>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors ${
                    activeTab === 'jobs' 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-[#162036] text-slate-300 hover:bg-[#1a2642] border border-[#1e2d4d]'
                  }`}
                >
                  <i className="ri-briefcase-line mr-2"></i>
                  Job Payments
                </button>
              </div>
              <div className="flex-1 w-full">
                <SearchFilterBar
                  searchQuery={searchTerm}
                  onSearchChange={setSearchTerm}
                  searchPlaceholder={activeTab === 'subscription' ? 'Search invoice ID...' : 'Search job title...'}
                  filters={{
                    status: paymentStatusFilter,
                    amount: amountFilter,
                    date_from: dateFrom,
                    date_to: dateTo,
                  }}
                  onFilterChange={handleFilterChange}
                  filterConfigs={PAYMENT_FILTER_CONFIGS}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  sortOptions={PAYMENT_SORT_OPTIONS}
                  resultCount={filteredPayments.length}
                  loading={loading}
                  onClear={handleClearFilters}
                  showMobilePanel={showFilters}
                  onToggleMobilePanel={() => setShowFilters((v) => !v)}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#162036] border-b border-[#1e2d4d]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">
                      {activeTab === 'subscription' ? 'Invoice' : 'Transaction'}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d4d]">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-[#162036]/50">
                      <td className="px-6 py-4">
                        {activeTab === 'subscription' ? (
                          <>
                            <div className="font-medium text-slate-200">
                              {payment.billing_reason?.replace('_', ' ').toUpperCase() || 'Subscription Payment'}
                            </div>
                            <div className="text-sm text-slate-500 font-mono">
                              {payment.stripe_invoice_id?.slice(0, 20)}...
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium text-slate-200">{payment.description || 'Job Payment'}</div>
                            <div className="text-sm text-slate-500">{payment.jobs?.job_title || 'N/A'}</div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300">
                          {new Date(payment.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-sm text-slate-500">
                          {new Date(payment.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-lg font-bold text-white">£{parseFloat(payment.amount).toFixed(2)}</div>
                        <div className="text-sm text-slate-500">{payment.currency?.toUpperCase() || 'GBP'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {getStatusLabel(payment.status)}
                        </span>
                        {payment.refunded && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/25">
                            REFUNDED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {activeTab === 'subscription' && payment.invoice_url && (
                            <a
                              href={payment.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-400 hover:text-teal-300 text-sm font-medium whitespace-nowrap flex items-center gap-1"
                            >
                              <i className="ri-file-text-line"></i>
                              Invoice
                            </a>
                          )}
                          {activeTab === 'jobs' && (payment.status === 'completed' || payment.status === 'succeeded') && (
                            <>
                              <button
                                onClick={() => handleDownloadInvoice(payment)}
                                disabled={invoiceLoading}
                                className="text-teal-400 hover:text-teal-300 text-sm font-medium whitespace-nowrap flex items-center gap-1 cursor-pointer"
                              >
                                <i className="ri-download-line"></i>
                                Download
                              </button>
                              <button
                                onClick={() => handleSendInvoiceEmail(payment)}
                                disabled={emailSending}
                                className="text-violet-400 hover:text-violet-300 text-sm font-medium whitespace-nowrap flex items-center gap-1 cursor-pointer"
                              >
                                <i className="ri-mail-send-line"></i>
                                Send to Email
                              </button>
                            </>
                          )}
                          {activeTab === 'jobs' && payment.status === 'failed' && (
                            <button
                              onClick={() => handleRetryPayment(payment)}
                              className="text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap flex items-center gap-1 cursor-pointer"
                            >
                              <i className="ri-refresh-line"></i>
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowDetailModal(true);
                            }}
                            className="text-slate-400 hover:text-slate-300 font-medium text-sm whitespace-nowrap"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPayments.length === 0 && (
              <div className="p-10 md:p-12 text-center">
                <div className="w-16 h-16 flex items-center justify-center bg-[#162036] rounded-2xl mx-auto mb-4 border border-[#1e2d4d]">
                  <i className="ri-file-list-line text-3xl text-slate-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">No payments found</h3>
                <p className="text-slate-500 mb-6 text-sm">
                  {activeTab === 'subscription'
                    ? "You have not made any subscription payments yet"
                    : "Job payments will appear here after completing a security booking"
                  }
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {activeTab === 'jobs' && (
                    <Link href="/client/post-job">
                      <button className="inline-flex items-center gap-2 bg-teal-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap text-sm">
                        <i className="ri-add-circle-line"></i>Post Your First Job
                      </button>
                    </Link>
                  )}
                  {activeTab === 'subscription' && (
                    <Link href="/pricing">
                      <button className="inline-flex items-center gap-2 bg-teal-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap text-sm">
                        <i className="ri-price-tag-3-line"></i>View Plans
                      </button>
                    </Link>
                  )}
                  <Link href="/client/support">
                    <button className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 font-semibold px-6 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap text-sm border border-[#1e2d4d]">
                      <i className="ri-customer-service-2-line"></i>Contact Support
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]">
            <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-8 py-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Payment Details</h2>
                <p className="text-sm text-slate-500 mt-1 font-mono">ID: {selectedPayment.id.slice(0, 16)}...</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#162036] transition-colors"
              >
                <i className="ri-close-line text-2xl text-slate-400"></i>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className={`rounded-xl p-6 ${
                selectedPayment.status === 'succeeded' || selectedPayment.status === 'completed'
                  ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/25' 
                  : selectedPayment.status === 'failed'
                  ? 'bg-gradient-to-br from-red-500/10 to-orange-600/10 border border-red-500/25'
                  : 'bg-gradient-to-br from-teal-500/10 to-blue-600/10 border border-teal-500/25'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Amount</p>
                    <p className="text-4xl font-bold text-white">£{parseFloat(selectedPayment.amount).toFixed(2)}</p>
                  </div>
                  <div className="w-16 h-16 flex items-center justify-center bg-[#162036] rounded-full border border-[#1e2d4d]">
                    <i className={`ri-money-pound-circle-line text-3xl ${
                      selectedPayment.status === 'succeeded' || selectedPayment.status === 'completed' ? 'text-emerald-400' : 
                      selectedPayment.status === 'failed' ? 'text-red-400' : 'text-teal-400'
                    }`}></i>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPayment.status)}`}>
                    {selectedPayment.status?.toUpperCase()}
                  </span>
                  {selectedPayment.refunded && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/25">
                      REFUNDED: £{parseFloat(selectedPayment.refund_amount || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-information-line text-teal-400"></i>
                  Payment Information
                </h3>
                <div className="bg-[#162036] rounded-lg p-6 space-y-3 border border-[#1e2d4d]">
                  {activeTab === 'subscription' ? (
                    <>
                      <div>
                        <p className="text-sm text-slate-500">Billing Reason</p>
                        <p className="font-semibold text-slate-200">
                          {selectedPayment.billing_reason?.replace('_', ' ').toUpperCase() || 'N/A'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4d]">
                        <div>
                          <p className="text-sm text-slate-500">Period Start</p>
                          <p className="font-medium text-slate-200">
                            {selectedPayment.period_start 
                              ? new Date(selectedPayment.period_start).toLocaleDateString('en-GB')
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Period End</p>
                          <p className="font-medium text-slate-200">
                            {selectedPayment.period_end 
                              ? new Date(selectedPayment.period_end).toLocaleDateString('en-GB')
                              : 'N/A'
                            }
                          </p>
                        </div>
                      </div>
                      {selectedPayment.stripe_invoice_id && (
                        <div className="pt-3 border-t border-[#1e2d4d]">
                          <p className="text-sm text-slate-500">Stripe Invoice ID</p>
                          <p className="font-mono text-sm text-slate-300 break-all">{selectedPayment.stripe_invoice_id}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm text-slate-500">Description</p>
                        <p className="font-semibold text-slate-200">{selectedPayment.description || 'N/A'}</p>
                      </div>
                      {selectedPayment.jobs && (
                        <div className="pt-3 border-t border-[#1e2d4d]">
                          <p className="text-sm text-slate-500">Job Title</p>
                          <p className="font-semibold text-slate-200">{selectedPayment.jobs.job_title}</p>
                        </div>
                      )}
                    </>
                  )}
                  {selectedPayment.failure_reason && (
                    <div className="pt-3 border-t border-[#1e2d4d]">
                      <p className="text-sm text-slate-500">Failure Reason</p>
                      <p className="font-medium text-red-400">{selectedPayment.failure_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {selectedPayment.invoice_url && (
                  <a
                    href={selectedPayment.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap text-center"
                  >
                    <i className="ri-file-text-line mr-2"></i>
                    View Invoice
                  </a>
                )}
                {activeTab === 'jobs' && selectedPayment.status === 'failed' && (
                  <button
                    onClick={() => {
                      handleRetryPayment(selectedPayment);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors whitespace-nowrap text-center flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="ri-refresh-line"></i>
                    Retry Payment
                  </button>
                )}
                {activeTab === 'jobs' && (selectedPayment.status === 'completed' || selectedPayment.status === 'succeeded') && (
                  <>
                    <button
                      onClick={() => handleDownloadInvoice(selectedPayment)}
                      disabled={invoiceLoading}
                      className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="ri-download-line"></i>
                      Download Invoice
                    </button>
                    <button
                      onClick={() => handleSendInvoiceEmail(selectedPayment)}
                      disabled={emailSending}
                      className="flex-1 bg-violet-500 text-white py-3 rounded-lg font-semibold hover:bg-violet-600 transition-colors whitespace-nowrap text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="ri-mail-send-line"></i>
                      Send to Email
                    </button>
                  </>
                )}
                {selectedPayment.receipt_url && (
                  <a
                    href={selectedPayment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap text-center"
                  >
                    <i className="ri-receipt-line mr-2"></i>
                    Receipt
                  </a>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-lg font-semibold hover:bg-[#1a2642] transition-colors whitespace-nowrap border border-[#1e2d4d]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvoicePreview && invoiceData && (
        <InvoicePreview
          job={invoiceData.job}
          client={invoiceData.client}
          guards={invoiceData.guards}
          costs={invoiceData.costs}
          invoiceNumber={invoiceData.invoiceNumber}
          onClose={() => {
            setShowInvoicePreview(false);
            setInvoiceData(null);
          }}
        />
      )}

      {emailToast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-6 py-3 rounded-xl shadow-lg font-medium text-sm transition-all ${
          emailToast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <i className={emailToast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
            {emailToast.message}
          </div>
        </div>
      )}
    </div>
  );
}