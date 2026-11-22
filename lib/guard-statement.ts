import type { PdfReport } from './report-pdf';
import { isPaidGuardPayoutStatus } from './payments/guardPaymentDisplay';

export interface StatementPayment {
  date: string; jobTitle: string; clientName: string; grossAmount: number;
  platformFee: number; netPayout: number; transferStatus: string;
}
export function statementMonth(date: string): string {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(value);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
}
export function guardStatement(payments: readonly StatementPayment[], month: string): PdfReport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid statement month.');
  const rows = payments.filter(p => statementMonth(p.date) === month);
  const money = (n: number) => { if (!Number.isFinite(n)) throw new Error('Recorded amount unavailable.'); return `£${n.toFixed(2)}`; };
  const paid = rows.filter(p => isPaidGuardPayoutStatus(p.transferStatus));
  return {
    title: `Guard payment statement — ${month}`,
    columns: ['Recorded date (UK)', 'Job', 'Client', 'Gross', 'Fee', 'Net', 'Transfer status'],
    rows: rows.map(p => [new Date(p.date).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }), p.jobTitle, p.clientName, money(p.grossAmount), money(p.platformFee), money(p.netPayout), p.transferStatus]),
    summary: [`Period: ${month}, grouped by assignment date in Europe/London. Currency: GBP.`,
      `Recorded completed transfers: ${paid.length}; net ${money(paid.reduce((n, p) => n + p.netPayout, 0))}.`,
      'Pending, held and failed transfers are not paid earnings. Transfer completion does not confirm bank arrival.',
      'Payment record only; not a VAT invoice or confirmation of tax paid.',
      ...(rows.length ? [] : ['No recorded payments for this month.'])],
  };
}
