'use client';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Payment {
  id: string;
  date: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  stripe_fee: number;
  net_amount: number;
  status: string;
  invoice_id: string;
}

interface Props {
  payment: Payment;
}

export default function PaymentRow({ payment }: Props) {
  const statusColor =
    payment.status === 'succeeded' || payment.status === 'completed'
      ? 'bg-emerald-400/15 text-emerald-300'
      : payment.status === 'failed'
      ? 'bg-red-400/15 text-red-300'
      : 'bg-amber-400/15 text-amber-300';

  return (
    <tr className="hover:bg-[#162544] transition-colors">
      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{formatDate(payment.date)}</td>
      <td className="px-4 py-3 text-sm font-medium text-white">{payment.customer}</td>
      <td className="px-4 py-3 text-sm text-slate-400">{payment.email}</td>
      <td className="px-4 py-3 text-sm text-slate-400">{payment.plan}</td>
      <td className="px-4 py-3 text-sm font-medium text-white">{formatCurrency(payment.amount)}</td>
      <td className="px-4 py-3 text-sm text-slate-400">{formatCurrency(payment.stripe_fee)}</td>
      <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(payment.net_amount)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {payment.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 font-mono">{payment.invoice_id || '-'}</td>
    </tr>
  );
}