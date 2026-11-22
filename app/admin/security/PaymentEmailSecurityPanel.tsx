'use client';

import { PaymentEmailData } from './SecuritySOCClient';

interface Props {
  paymentEmailData: PaymentEmailData | null;
}

interface MetricCardData {
  label: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
  icon: string;
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const colors = metric.status === 'healthy'
    ? { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }
    : metric.status === 'warning'
    ? { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' }
    : { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' };

  return (
    <div className={`bg-[#0a1628] rounded-xl border p-3.5 ${colors.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{metric.label}</span>
        <div className={`w-6 h-6 flex items-center justify-center rounded ${colors.bg}`}>
          <i className={`${metric.icon} text-xs ${colors.text}`}></i>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-200">{metric.value}</p>
    </div>
  );
}

export default function PaymentEmailSecurityPanel({ paymentEmailData }: Props) {
  const d = paymentEmailData;
  const emailConfigured = d?.email.configured ?? d?.email.smtpConnected ?? false;

  const stripeMetrics: MetricCardData[] = d ? [
    { label: 'Stripe API Health', value: d.stripe.apiHealth?.status === 'healthy' ? 'Verified' : d.stripe.apiHealth?.error || 'Not checked', status: d.stripe.apiHealth?.status === 'healthy' ? 'healthy' : 'warning', icon: 'ri-bank-card-line' },
    { label: 'Webhook Activity', value: d.stripe.webhookStatus, status: d.stripe.webhookStatus === 'Recent activity recorded' ? 'healthy' : 'warning', icon: 'ri-webhook-line' },
    { label: 'Webhook Verification', value: d.stripe.webhookVerification, status: 'warning', icon: 'ri-shield-check-line' },
    { label: 'Failed Events (24h)', value: d.stripe.failedEvents24h, status: d.stripe.failedEvents24h > 0 ? 'warning' : 'healthy', icon: 'ri-error-warning-line' },
    { label: 'Pending Events', value: d.stripe.pendingEvents ?? 'Not checked', status: d.stripe.pendingEvents === null || d.stripe.pendingEvents > 5 ? 'warning' : 'healthy', icon: 'ri-time-line' },
    { label: 'Failed Payouts', value: d.stripe.failedPayouts ?? 'Not checked', status: d.stripe.failedPayouts === undefined ? 'warning' : d.stripe.failedPayouts > 0 ? 'critical' : 'healthy', icon: 'ri-bank-line' },
    { label: 'Pending Payouts', value: d.stripe.pendingPayouts, status: d.stripe.pendingPayouts > 5 ? 'warning' : 'healthy', icon: 'ri-bank-line' },
    { label: 'Open Disputes', value: d.stripe.openDisputes, status: d.stripe.openDisputes > 0 ? 'critical' : 'healthy', icon: 'ri-scales-line' },
    { label: 'Refunded Payments (7d)', value: d.stripe.refunds, status: 'healthy', icon: 'ri-refund-2-line' },
    { label: 'Webhook Latency', value: d.stripe.webhookLatency, status: d.stripe.webhookLatency === '—' ? 'warning' : 'healthy', icon: 'ri-speed-line' },
    { label: 'Signing Secret', value: d.stripe.signingSecret, status: d.stripe.signingSecret === 'Configured' ? 'healthy' : 'critical', icon: 'ri-key-2-fill' },
    { label: 'Latest Webhook', value: d.stripe.latestWebhook ? new Date(d.stripe.latestWebhook).toLocaleString() : 'None', status: d.stripe.webhookStatus === 'Recent activity recorded' ? 'healthy' : 'warning', icon: 'ri-history-line' },
  ] : [
    { label: 'Webhook Status', value: 'No data', status: 'warning', icon: 'ri-webhook-line' },
    { label: 'Failed Events', value: '—', status: 'warning', icon: 'ri-error-warning-line' },
    { label: 'Pending Payouts', value: '—', status: 'warning', icon: 'ri-bank-line' },
    { label: 'Signing Secret', value: 'Unknown', status: 'warning', icon: 'ri-key-2-fill' },
  ];

  const emailMetrics: MetricCardData[] = d ? [
    { label: d.email.provider || 'Email Provider', value: emailConfigured ? 'Configured' : 'Not Configured', status: emailConfigured ? 'healthy' : 'critical', icon: 'ri-plug-line' },
    { label: 'Queue Status', value: `${d.email.queuePending} pending`, status: d.email.queuePending > 50 ? 'warning' : 'healthy', icon: 'ri-stack-line' },
    { label: 'Failed Emails (24h)', value: String(d.email.failedEmails24h), status: d.email.failedEmails24h > 5 ? 'warning' : 'healthy', icon: 'ri-mail-close-line' },
    { label: 'Sent Today', value: String(d.email.sentToday), status: 'healthy', icon: 'ri-send-plane-line' },
    { label: 'Bounce Rate', value: d.email.bounceRate ?? 'Not checked', status: d.email.bounceRate === null || parseFloat(d.email.bounceRate) > 2 ? 'warning' : 'healthy', icon: 'ri-arrow-go-back-line' },
    { label: 'SPF Record', value: d.email.spfValid === null ? 'Not checked' : d.email.spfValid ? 'Valid' : 'Invalid', status: d.email.spfValid === null ? 'warning' : d.email.spfValid ? 'healthy' : 'critical', icon: 'ri-check-double-line' },
    { label: 'DKIM Record', value: d.email.dkimValid === null ? 'Not checked' : d.email.dkimValid ? 'Valid' : 'Invalid', status: d.email.dkimValid === null ? 'warning' : d.email.dkimValid ? 'healthy' : 'critical', icon: 'ri-check-double-line' },
    { label: 'Daily Send Count', value: String(d.email.dailySendCount), status: 'healthy', icon: 'ri-send-plane-line' },
  ] : [
    { label: 'SMTP Connection', value: 'No data', status: 'warning', icon: 'ri-plug-line' },
    { label: 'Queue Status', value: '—', status: 'warning', icon: 'ri-stack-line' },
    { label: 'Failed Emails', value: '—', status: 'warning', icon: 'ri-mail-close-line' },
    { label: 'Daily Send Count', value: '—', status: 'warning', icon: 'ri-send-plane-line' },
  ];

  const stripeStatus = d ? (d.stripe.apiHealth?.status !== 'healthy' || d.stripe.failedEvents24h > 0 || (d.stripe.failedPayouts ?? 0) > 0 || d.stripe.openDisputes > 0 || d.stripe.signingSecret !== 'Configured' ? 'Needs Attention' : 'No Recorded Failures') : 'Data Unavailable';
  const emailStatus = d ? (d.email.failedEmails24h > 3 || !emailConfigured ? 'Needs Attention' : 'Configured') : 'Data Unavailable';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-violet-500/10 rounded-lg">
            <i className="ri-bank-card-line text-violet-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Stripe Security</h2>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${stripeStatus === 'No Recorded Failures' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {stripeStatus}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stripeMetrics.map((m) => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </div>

      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-sky-500/10 rounded-lg">
            <i className="ri-mail-line text-sky-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Email Security</h2>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${emailStatus === 'Configured' ? 'bg-emerald-500/10 text-emerald-400' : emailStatus === 'Data Unavailable' ? 'bg-slate-500/10 text-slate-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {emailStatus}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {emailMetrics.map((m) => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
