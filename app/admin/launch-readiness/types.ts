export type CheckStatus = 'pass' | 'fail' | 'warning' | 'not_verified';
export type CheckCategory = 'critical' | 'warning';
export type Decision = 'GO' | 'CONDITIONAL GO' | 'NO-GO';

export interface LaunchCheck {
  id: string;
  category: CheckCategory;
  label: string;
  status: CheckStatus;
  method: 'auto' | 'manual';
  notes: string;
  instruction: string | null;
  lastChecked: string;
  verifiedBy: string;
  evidence: string;
  signedOffBy?: string;
  signedOffAt?: string | null;
}

export interface SavedDecision {
  id: string;
  decision: Decision;
  notes: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  created_at: string;
}

export type RetirementClassification = 'active' | 'retired_removable' | 'retired_disabled' | 'needs_verification';
export type RetirementDecision = 'delete' | 'disable' | 'keep';

export interface RetirementRecord {
  slug: string;
  name: string;
  classification: RetirementClassification;
  replacement: string | null;
  lastInvocation: string;
  knownCallers: string;
  cronWebhook: string;
  securityRisk: string;
  reviewer: string;
  reviewDate: string;
  evidence: string;
}

export interface RetirementApproval {
  id: string;
  function_slug: string;
  function_name: string;
  classification: string;
  decision: string;
  replacement: string | null;
  evidence: string | null;
  reason: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  created_at: string;
}