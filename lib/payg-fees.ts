import { bookingAmounts } from '@/supabase/functions/_shared/booking-policy';

// Client-side fee estimates use the same rounding as checkout.
// Server-side is authoritative; this is for UI previews only

export interface FeeBreakdown {
  guardRate: number;
  hours: number;
  numberOfGuards: number;
  numberOfDays: number;
  guardTotal: number;
  serviceFeePct: number;
  serviceFee: number;
  serviceFeeLabel: string;
  promoDiscountPct: number | null;
  promoDiscount: number;
  totalBeforeDiscount: number;
  total: number;
  savings: number;
}

export function calculatePaygFees(params: {
  hourlyRate: number;
  hours: number;
  numberOfGuards: number;
  numberOfDays: number;
  serviceFeePct?: number;
  serviceFeeFixedPence?: number;
  promoDiscountPct?: number | null;
}): FeeBreakdown {
  const {
    hourlyRate,
    hours,
    numberOfGuards,
    numberOfDays,
    serviceFeePct = 15,
    serviceFeeFixedPence = 0,
    promoDiscountPct = null,
  } = params;

  const grossPerGuardPence = Math.max(0, Math.round(hourlyRate * hours * numberOfDays * 100));
  const amounts = grossPerGuardPence > 0
    ? bookingAmounts(grossPerGuardPence, serviceFeePct, serviceFeeFixedPence)
    : { platformFeePence: 0 };
  const guardTotal = grossPerGuardPence * numberOfGuards / 100;
  const rawFee = amounts.platformFeePence * numberOfGuards / 100;

  let serviceFee = rawFee;
  let serviceFeeLabel = `${serviceFeePct}%${serviceFeeFixedPence ? ` + ${formatCurrency(serviceFeeFixedPence / 100)} per guard` : ''}`;
  let savings = 0;

  if (promoDiscountPct !== null && promoDiscountPct > 0) {
    const discountAmount = rawFee * (promoDiscountPct / 100);
    serviceFee = Math.max(0, rawFee - discountAmount);
    savings = discountAmount;
    serviceFeeLabel = promoDiscountPct >= 100
      ? 'Waived (promo)'
      : `${serviceFeePct}% — ${promoDiscountPct}% off`;
  }

  const totalBeforeDiscount = guardTotal + rawFee;
  const total = guardTotal + serviceFee;

  return {
    guardRate: hourlyRate,
    hours,
    numberOfGuards,
    numberOfDays,
    guardTotal,
    serviceFeePct,
    serviceFee,
    serviceFeeLabel,
    promoDiscountPct,
    promoDiscount: savings,
    totalBeforeDiscount,
    total,
    savings,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}