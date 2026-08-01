// Client-side fee calculation for PAYG tier
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
  promoDiscountPct?: number | null;
}): FeeBreakdown {
  const {
    hourlyRate,
    hours,
    numberOfGuards,
    numberOfDays,
    serviceFeePct = 15,
    promoDiscountPct = null,
  } = params;

  const guardTotal = hourlyRate * hours * numberOfGuards * numberOfDays;
  const rawFee = guardTotal * (serviceFeePct / 100);

  let serviceFee = rawFee;
  let serviceFeeLabel = `${serviceFeePct}%`;
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