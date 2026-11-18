export interface SandboxPlan {
  slug: string;
  label: string;
  monthlyPricePence: number;
}

export interface SandboxEligibility {
  eligible: boolean;
  code: string;
  message: string;
}

export interface SandboxTrialBoundary {
  offerStartIso?: string;
  offerEndIso?: string;
  offerEndExclusive?: boolean;
  firstChargeIso: string;
  lastSupportedCheckoutIso: string;
  stripeMinimumBoundaryIso?: string;
  stripeMinimumLeadHours: number;
  stripeMinimumAlreadyExceeded: boolean;
}

export interface SandboxStatus {
  accountType?: 'guard' | 'client';
  plans: SandboxPlan[];
  eligibility: SandboxEligibility;
  trialBoundary: SandboxTrialBoundary;
  notice?: string;
}

export interface SandboxBlocked {
  code?: string;
  message: string;
}