"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JobSummaryCard from './JobSummaryCard';
import AssignedGuardsSection from '../AssignedGuardsSection';
import CostBreakdown from './CostBreakdown';
import InvoicePreview from './InvoicePreview';
import PaymentStatusBadge from './PaymentStatusBadge';
import PaymentBlockers from './PaymentBlockers';
import PaymentActions from './PaymentActions';
import ReceiptDisplay from './ReceiptDisplay';
import PaymentHistoryMini from './PaymentHistoryMini';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import ContextualHelpCard from '@/app/client/help/ContextualHelpCard';
import TaxDisclaimerCheckbox from '@/components/TaxDisclaimerCheckbox';

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
  status: string;
  total_cost?: number;
  clients: {
    id: string;
    company_name: string;
    email: string;
    stripe_customer_id?: string;
  };
  job_assignments: Array<{
    id: string;
    guard_id: string;
    payment_amount: number;
    guards: {
      id: string;
      full_name: string;
      profile_image_url: string;
      hourly_rate: number;
      rating: number;
      sia_verified: boolean;
    };
  }>;
}

interface Guard {
  id: string;
  full_name: string;
  profile_image_url: string;
  hourly_rate: number;
  rating: number;
  sia_verified: boolean;
  hours_worked?: number;
}

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

interface Transaction {
  id: string;
  job_id: string;
  status: string;
  payment_status: string | null;
  amount: number;
  created_at: string;
  completed_at: string | null;
  stripe_payment_intent: string | null;
  stripe_charge_id: string | null;
  stripe_invoice_id: string | null;
  receipt_url: string | null;
  invoice_url: string | null;
  failure_reason: string | null;
  refunded: boolean;
  refund_amount: number | null;
  refunded_at: string | null;
  gateway_name: string | null;
  retry_count: number | null;
  last_retry_at: string | null;
}

interface PaymentHistoryItem {
  id: string;
  date: string;
  jobTitle: string;
  amount: string;
  status: string;
  receiptUrl: string | null;
}

interface FeeBreakdown {
  guardFees: number;
  platformFee: number;
  platformFeePercent: number;
  stripeFeeEstimate: number;
  stripeFeePayer: string;
  clientTotalCharge: number;
  guardPayoutAmount: number;
  quickguardNetFee: number;
  payoutDelayDays: number;
  autoReleaseHours: number;
  disputeWindowHours: number;
  hours: number;
  days: number;
  taxDisclaimerAccepted: boolean;
}

function getPaymentStatus(job: Job & { payment_status?: string | null }, transaction: Transaction | null): string {
  if (transaction?.refunded) return "refunded";
  if (transaction?.status === "disputed" || transaction?.payment_status === "disputed") return "disputed";
  if (transaction?.status === "completed" || transaction?.payment_status === "completed" || transaction?.status === "succeeded" || transaction?.payment_status === "succeeded") return "paid";
  if (job.payment_status === 'funded') return "funded";
  if (transaction?.status === "failed" || transaction?.payment_status === "failed") return "failed";
  if (transaction?.status === "pending" || transaction?.payment_status === "pending" || transaction?.status === "processing" || transaction?.payment_status === "processing") return "processing";
  if (transaction?.status === "invoice_sent" || transaction?.payment_status === "invoice_sent") return "invoice_sent";
  if (job.status === "awaiting_payment" || job.payment_status === 'payment_pending') return "pending_payment";
  if (job.status === "paid") return "paid";
  return "not_required";
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr?: string) {
  if (!timeStr) return "N/A";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function PaymentClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "invoice">("card");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [taxDisclaimerAccepted, setTaxDisclaimerAccepted] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [toast, setToast] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [maxRetriesReached, setMaxRetriesReached] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPaymentData();
  }, [jobId]);

  const loadPaymentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clientData) {
        router.push("/client/login");
        return;
      }
      setClient(clientData);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select(`
          *,
          payment_status,
          agreed_amount,
          platform_fee,
          guard_payout_amount,
          clients (
            id,
            company_name,
            email,
            stripe_customer_id
          ),
          job_assignments (
            id,
            guard_id,
            payment_amount,
            guards (
              id,
              full_name,
              profile_image_url,
              hourly_rate,
              rating,
              sia_verified
            )
          )
        `)
        .eq("id", jobId)
        .eq("client_id", clientData.id)
        .maybeSingle();

      if (jobError || !jobData) {
        console.error("Error loading job:", jobError);
        router.push("/client/jobs");
        return;
      }

      setJob(jobData);
      setTaxDisclaimerAccepted(jobData.tax_disclaimer_accepted || false);

      if (jobData.job_assignments && jobData.job_assignments.length > 0) {
        const guardsWithHours = jobData.job_assignments.map((assignment: any) => ({
          ...assignment.guards,
          hours_worked: calculateHours(jobData.start_time, jobData.end_time, jobData.start_date, jobData.end_date)
        }));
        setGuards(guardsWithHours);
      }

      await loadTransaction(jobData.id, clientData.id);
      await loadPaymentHistory(clientData.id);
      await loadFeeBreakdown(jobData.id);
    } catch (error) {
      console.error("Error loading payment data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeeBreakdown = async (jobId: string) => {
    setFeeLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calculate-job-fees`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionData.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ jobId }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          setFeeBreakdown(data);
          setTaxDisclaimerAccepted(data.taxDisclaimerAccepted || false);
        }
      }
    } catch (error) {
      console.error("Error loading fee breakdown:", error);
    } finally {
      setFeeLoading(false);
    }
  };

  const loadTransaction = async (jobId: string, clientId: string) => {
    try {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("job_id", jobId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (transactions && transactions.length > 0) {
        setTransaction(transactions[0]);
        setRetryCount(transactions[0].retry_count || 0);
        setFailureReason(transactions[0].failure_reason || null);
        setMaxRetriesReached((transactions[0].retry_count || 0) >= 3);
      } else {
        setTransaction(null);
        setRetryCount(0);
        setFailureReason(null);
        setMaxRetriesReached(false);
      }
    } catch (error) {
      console.error("Error loading transaction:", error);
    }
  };

  const loadPaymentHistory = async (clientId: string) => {
    try {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*, jobs:job_id(job_title)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (transactions) {
        const history = transactions.map((t: any) => ({
          id: t.id,
          date: formatDate(t.created_at),
          jobTitle: t.jobs?.job_title || t.description || "Job Payment",
          amount: `£${parseFloat(t.amount || 0).toFixed(2)}`,
          status: t.status || t.payment_status || "pending",
          receiptUrl: t.receipt_url || null,
        }));
        setPaymentHistory(history);
      }
    } catch (error) {
      console.error("Error loading payment history:", error);
    }
  };

  const calculateHours = (startTime: string, endTime: string, startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate || startDate}T${endTime}`);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    const startD = new Date(startDate);
    const endD = new Date(endDate || startDate);
    const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return hours * days;
  };

  const calculateCosts = () => {
    if (!job) return { guardFees: 0, serviceFee: 0, vat: 0, total: 0, hours: 0 };
    const hours = calculateHours(job.start_time, job.end_time, job.start_date, job.end_date);
    const guardFees = hours * job.hourly_rate * guards.length;
    const serviceFee = guardFees * 0.10;
    const subtotal = guardFees + serviceFee;
    const vat = subtotal * 0.20;
    const total = subtotal + vat;
    return {
      hours,
      guardFees: Math.round(guardFees * 100) / 100,
      serviceFee: Math.round(serviceFee * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  const handlePayment = async () => {
    if (!job || !client) return;
    if (!taxDisclaimerAccepted) {
      setToast("Please accept the tax responsibility statement before proceeding.");
      setTimeout(() => setToast(""), 4000);
      return;
    }
    setProcessing(true);
    try {
      // Save tax disclaimer acceptance
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !job.tax_disclaimer_accepted) {
        await supabase.from('jobs').update({
          tax_disclaimer_accepted: true,
          tax_disclaimer_accepted_at: new Date().toISOString(),
        }).eq('id', job.id);
        await supabase.from('tax_disclaimers_accepted').upsert({
          user_id: user.id,
          user_type: 'client',
          disclaimer_type: 'job_payment',
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'user_id, user_type, disclaimer_type' });
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionData.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        }
      );
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create payment session");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setToast("Payment failed. Please try again or contact support.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestInvoice = async () => {
    if (!job || !client) return;
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setToast("Invoice requested! Our billing team will send an invoice to your email shortly.");
      setTimeout(() => setToast(""), 4000);
      loadTransaction(job.id, client.id);
    } catch (error) {
      console.error("Invoice request error:", error);
      setToast("Invoice request failed. Please try again or contact support.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = async () => {
    if (!job || !client || maxRetriesReached) return;
    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionData.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        }
      );
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        if (data.error === 'Payment already completed for this job') {
          setToast('This job has already been paid. Refreshing...');
          setTimeout(() => {
            loadTransaction(job.id, client.id);
            setToast("");
          }, 2000);
        } else {
          throw new Error(data.error);
        }
      } else {
        throw new Error("Failed to create payment session");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setToast("Retry failed. Please try again or contact support.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };

  const handleViewInvoice = () => {
    setShowInvoicePreview(true);
  };

  const handleDownloadReceipt = () => {
    setShowInvoicePreview(true);
  };

  const handleContactSupport = () => {
    setShowSupportModal(true);
  };

  const handleViewReceipt = (payment: PaymentHistoryItem) => {
    if (payment.receiptUrl) {
      window.open(payment.receiptUrl, "_blank", "noopener,noreferrer");
    }
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    return `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${jobId.slice(0, 6).toUpperCase()}`;
  };

  const handleDownloadInvoice = () => {
    setShowInvoicePreview(true);
  };

  const onPayNow = () => {
    if (paymentMethod === "card") {
      handlePayment();
    } else {
      handleRequestInvoice();
    }
  };

  const handleProceedToConfirmation = async () => {
    if (!job) return;
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'awaiting_client_confirmation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      router.push(`/client/jobs/${jobId}/confirmation`);
    } catch (e) {
      console.error('Failed to update status:', e);
      router.push(`/client/jobs/${jobId}/confirmation`);
    }
  };

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.escrow_payments" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!job || !client) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-4xl text-red-400"></i>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Job Not Found</h2>
          <p className="text-slate-400 mb-6">This job doesn't exist or you don't have access to it.</p>
          <Link href="/client/jobs">
            <button className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
              Back to Jobs
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const costs = calculateCosts();
  const paymentStatus = getPaymentStatus(job, transaction);
  const hasReceipt = !!transaction?.receipt_url;
  const hasInvoice = !!transaction?.invoice_url;
  const receiptUrl = transaction?.receipt_url || null;
  const invoiceUrl = transaction?.invoice_url || null;

  const paymentMethodLabel = transaction?.gateway_name || "Stripe (Card)";
  const transactionDate = transaction?.completed_at || transaction?.created_at;
  const formattedTransactionDate = transactionDate ? formatDate(transactionDate) + " at " + new Date(transactionDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "N/A";

  const invoiceNumber = transaction?.stripe_invoice_id || transaction?.id?.slice(0, 12).toUpperCase() || generateInvoiceNumber();

  // Use fee breakdown from server if available
  const fb = feeBreakdown;
  const costBreakdownProps = fb ? {
    guards: guards.length,
    hours: fb.hours || costs.hours,
    hourlyRate: job.hourly_rate,
    guardFees: fb.guardFees,
    platformFee: fb.platformFee,
    platformFeePercent: fb.platformFeePercent,
    stripeFeeEstimate: fb.stripeFeeEstimate,
    stripeFeePayer: fb.stripeFeePayer,
    clientTotalCharge: fb.clientTotalCharge,
    guardPayoutAmount: fb.guardPayoutAmount,
    quickguardNetFee: fb.quickguardNetFee,
    vat: costs.vat,
    total: fb.clientTotalCharge,
    paymentStatus,
    jobTitle: job.job_title,
    location: `${job.venue_name}, ${job.venue_city}`,
    startDate: job.start_date,
    endDate: job.end_date,
    startTime: job.start_time,
    endTime: job.end_time,
  } : {
    guards: guards.length,
    hours: costs.hours,
    hourlyRate: job.hourly_rate,
    guardFees: costs.guardFees,
    platformFee: costs.serviceFee,
    platformFeePercent: 10,
    stripeFeeEstimate: 0,
    stripeFeePayer: 'client',
    vat: costs.vat,
    total: costs.total,
    paymentStatus,
    jobTitle: job.job_title,
    location: `${job.venue_name}, ${job.venue_city}`,
    startDate: job.start_date,
    endDate: job.end_date,
    startTime: job.start_time,
    endTime: job.end_time,
  };

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col">
      <Header />

      <div className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <Link href="/client/jobs" className="text-teal-400 hover:text-teal-300 font-medium mb-4 inline-flex items-center whitespace-nowrap cursor-pointer">
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Job Management
            </Link>
            <div className="mt-4">
              <ContextualHelpCard
                title="When guards are confirmed"
                tip="Payment is processed securely via Stripe. Your funds are held with Stripe and only released to guards after the shift is completed and confirmed. You can download your invoice at any time from Payment History."
                learnMoreHref="/client/help#payments-invoices"
                learnMoreLabel="Payment guide"
                icon="ri-secure-payment-line"
                variant="compact"
              />
            </div>
            <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Complete Payment</h1>
                <p className="text-slate-400 mt-1">Review job details and process payment for completed services</p>
              </div>
              <PaymentStatusBadge status={paymentStatus} size="lg" />
            </div>
          </div>

          {/* Funded Banner */}
          {paymentStatus === "funded" && (
            <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/25 p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-shield-check-fill text-emerald-400 text-xl"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-400">Job Funded — Guards Are Confirmed</p>
                  <p className="text-sm text-emerald-300 mt-1">
                    Payment received. The funds are held securely and guards have been notified. They can now check in when the shift starts.
                  </p>
                  <button
                    onClick={handleProceedToConfirmation}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-file-shield-line"></i>
                    Go to Booking Confirmation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Success Banner */}
          {(paymentStatus === "paid" || paymentStatus === "invoice_sent") && job.status !== 'awaiting_client_confirmation' && job.status !== 'confirmed' && job.status !== 'in_progress' && job.status !== 'completed' && (
            <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/25 p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-xl"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-400">Payment Complete</p>
                  <p className="text-sm text-emerald-300 mt-1">
                    Your payment has been processed successfully. The next step is to review and confirm your booking.
                  </p>
                  <button
                    onClick={handleProceedToConfirmation}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-file-shield-line"></i>
                    Proceed to Booking Confirmation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failure Reason Banner */}
          {paymentStatus === "failed" && (failureReason || retryCount > 0) && (
            <div className="bg-red-500/10 rounded-xl border border-red-500/25 p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-error-warning-line text-red-400"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">Payment Failed</p>
                  {failureReason && (
                    <p className="text-sm text-red-300 mt-1">{failureReason}</p>
                  )}
                  <p className="text-xs text-red-400/70 mt-2">
                    Attempt {retryCount} of 3
                    {maxRetriesReached && (
                      <span className="block mt-1 font-semibold text-red-400">Maximum retry attempts reached. Please contact support.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <PaymentBlockers
                paymentStatus={paymentStatus}
                jobStartDate={job.start_date}
                jobStartTime={job.start_time}
                transaction={transaction}
              />

              <JobSummaryCard job={job} hours={costs.hours || 0} />
              <AssignedGuardsSection guards={guards} hourlyRate={job.hourly_rate} hours={costs.hours || 0} />

              {/* Receipt Display for Paid / Refunded */}
              {(paymentStatus === "paid" || paymentStatus === "refunded" || paymentStatus === "invoice_sent") && (
                <ReceiptDisplay
                  invoiceNumber={invoiceNumber}
                  paymentDate={formattedTransactionDate}
                  paymentMethod={paymentMethodLabel}
                  billingName={client.company_name || "Client"}
                  billingEmail={client.email}
                  amount={`£${fb?.clientTotalCharge?.toFixed(2) || costs.total.toFixed(2)}`}
                  status={paymentStatus}
                  onDownload={handleDownloadInvoice}
                />
              )}

              {/* Payment Method Selection */}
              {(paymentStatus === "pending_payment" || paymentStatus === "not_required" || paymentStatus === "failed") && (
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="ri-bank-card-line text-teal-400"></i>
                    Payment Method
                  </h3>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "card" ? "border-teal-500 bg-teal-500/10" : "border-[#1e2d4d] hover:border-slate-600"}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === "card"}
                        onChange={() => setPaymentMethod("card")}
                        className="w-5 h-5 text-teal-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <i className="ri-visa-line text-white text-xl"></i>
                          </div>
                          <div>
                            <p className="font-semibold text-white">Pay with Card</p>
                            <p className="text-sm text-slate-400">Secure payment via Stripe</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-visa-fill text-2xl text-teal-400"></i>
                        <i className="ri-mastercard-fill text-2xl text-orange-400"></i>
                      </div>
                    </label>

                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "invoice" ? "border-teal-500 bg-teal-500/10" : "border-[#1e2d4d] hover:border-slate-600"}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="invoice"
                        checked={paymentMethod === "invoice"}
                        onChange={() => setPaymentMethod("invoice")}
                        className="w-5 h-5 text-teal-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <i className="ri-file-text-line text-white text-xl"></i>
                          </div>
                          <div>
                            <p className="font-semibold text-white">Request Invoice</p>
                            <p className="text-sm text-slate-400">Pay within 14 days via bank transfer</p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-medium whitespace-nowrap border border-emerald-500/25">Enterprise</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Tax Disclaimer */}
              {(paymentStatus === "pending_payment" || paymentStatus === "not_required" || paymentStatus === "failed") && (
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                  <TaxDisclaimerCheckbox
                    userType="client"
                    accepted={taxDisclaimerAccepted}
                    onChange={setTaxDisclaimerAccepted}
                    variant="compact"
                  />
                </div>
              )}

              {/* Terms Checkbox */}
              {(paymentStatus === "pending_payment" || paymentStatus === "not_required" || paymentStatus === "failed") && (
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-teal-500 rounded border-[#1e2d4d]"
                    />
                    <span className="text-sm text-slate-300">
                      I confirm that the security services have been completed satisfactorily and agree to the{" "}
                      <Link href="/terms" className="text-teal-400 hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/terms" className="text-teal-400 hover:underline">Payment Terms</Link>.
                    </span>
                  </label>
                </div>
              )}

              {/* Retry Help Section */}
              {paymentStatus === "failed" && (
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="ri-question-line text-teal-400"></i>
                    Why did my payment fail?
                  </h3>
                  <div className="space-y-3">
                    {[
                      { icon: 'ri-bank-card-line', title: 'Card declined', desc: 'Your bank may have blocked the transaction. Call your bank to authorise payments to QuickGuard.' },
                      { icon: 'ri-funds-line', title: 'Insufficient funds', desc: 'Ensure your account has enough funds to cover the full amount including fees.' },
                      { icon: 'ri-calendar-check-line', title: 'Card expired', desc: 'Check that your card expiry date and CVV are correct.' },
                      { icon: 'ri-shield-keyhole-line', title: '3D Secure failed', desc: 'You may have closed the authentication window too quickly. Try again and complete the bank verification.' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#162036]">
                        <div className="w-8 h-8 bg-[#1e2d4d] rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className={`${item.icon} text-teal-400`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mini Payment History */}
              {paymentHistory.length > 0 && (
                <PaymentHistoryMini payments={paymentHistory} onViewReceipt={handleViewReceipt} />
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <CostBreakdown {...costBreakdownProps} />

                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6 space-y-4">
                  <PaymentActions
                    paymentStatus={paymentStatus}
                    hasReceipt={hasReceipt}
                    receiptUrl={receiptUrl}
                    invoiceUrl={invoiceUrl}
                    onPayNow={onPayNow}
                    onRetry={handleRetry}
                    onViewInvoice={handleViewInvoice}
                    onDownloadReceipt={handleDownloadReceipt}
                    onContactSupport={handleContactSupport}
                    processing={processing}
                    agreedToTerms={agreedToTerms}
                    paymentMethod={paymentMethod}
                    totalAmount={fb?.clientTotalCharge?.toFixed(2) || costs.total.toFixed(2)}
                    retryCount={retryCount}
                    maxRetriesReached={maxRetriesReached}
                  />

                  <div className="flex items-center justify-center gap-4 pt-2">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <i className="ri-lock-line"></i>
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <i className="ri-shield-check-line"></i>
                      <span>Protected</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <i className="ri-bank-card-line"></i>
                      <span>Stripe</span>
                    </div>
                  </div>
                </div>

                <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/25">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ri-information-line text-teal-400"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-teal-400">Payment Protection</p>
                      <p className="text-xs text-teal-500 mt-1">
                        Your payment is protected by QuickGuard. Guards will be paid within {fb?.payoutDelayDays ?? 3}-{fb?.payoutDelayDays ? fb.payoutDelayDays + 2 : 5} business days after your payment is confirmed.
                      </p>
                    </div>
                  </div>
                </div>

                {fb?.stripeFeePayer && fb.stripeFeePayer !== 'client' && (
                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/25">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="ri-percent-line text-blue-400"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-400">Stripe Fee</p>
                        <p className="text-xs text-blue-500 mt-1">
                          Stripe processing fee is {fb.stripeFeePayer === 'guard' ? 'paid by the guard' : fb.stripeFeePayer === 'split' ? 'split between you and the guard' : 'included in QuickGuard fees'}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showInvoicePreview && job && client && (
        <InvoicePreview
          job={job}
          client={client}
          guards={guards}
          costs={costs}
          invoiceNumber={invoiceNumber}
          onClose={() => setShowInvoicePreview(false)}
          paymentStatus={paymentStatus}
          paymentDate={formattedTransactionDate}
          paymentMethod={paymentMethodLabel}
        />
      )}

      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-lg w-full border border-[#1e2d4d] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Contact Support</h2>
              <button onClick={() => setShowSupportModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#162036] transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-slate-400"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-[#162036] rounded-lg p-4 border border-[#1e2d4d]">
                <p className="text-sm font-semibold text-slate-200 mb-1">Email</p>
                <p className="text-sm text-teal-400">billing@quickguard.uk</p>
              </div>
              <div className="bg-[#162036] rounded-lg p-4 border border-[#1e2d4d]">
                <p className="text-sm font-semibold text-slate-200 mb-1">Phone</p>
                <p className="text-sm text-teal-400">0800 123 4567</p>
              </div>
              <div className="bg-[#162036] rounded-lg p-4 border border-[#1e2d4d]">
                <p className="text-sm font-semibold text-slate-200 mb-1">Job Reference</p>
                <p className="text-sm text-slate-400 font-mono">{job.id}</p>
                <p className="text-sm text-slate-400">{job.job_title}</p>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#111d35] border border-[#1e2d4d] rounded-xl px-4 py-3 shadow-lg flex items-center gap-2">
          <i className="ri-information-line text-teal-400"></i>
          <span className="text-sm text-slate-300">{toast}</span>
          <button onClick={() => setToast("")} className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 cursor-pointer">
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}