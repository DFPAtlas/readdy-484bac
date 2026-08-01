"use client";

export type SIAStatus = "valid" | "expiring_soon" | "expired" | "missing" | "pending" | "unverified";

export interface ComplianceInfo {
  siaStatus: SIAStatus;
  siaStatusLabel: string;
  siaExpiryDate: string | null;
  siaLicenceNumber: string | null;
  siaLicenceTypes: string[] | null;
  siaVerified: boolean;
  siaVerifiedAt: string | null;
  siaLicenceFrontUrl: string | null;
  siaLicenceBackUrl: string | null;
  profileCompleted: boolean;
  verificationStatus: string | null;
  certifications: string[] | null;
  rightToWork: "verified" | "pending" | "missing";
  insuranceStatus: "verified" | "pending" | "missing";
  trainingStatus: "verified" | "pending" | "missing";
  overallScore: number;
  isFullyCompliant: boolean;
  needsAttention: boolean;
  attentionReasons: string[];
  licenceMatchStatus?: "matched" | "mismatch" | "unknown";
  requiredLicenceTypes?: string[] | null;
}

export interface GuardComplianceData {
  id: string;
  full_name: string;
  sia_verified: boolean;
  sia_expiry_date: string | null;
  sia_licence_number: string | null;
  licence_types: string[] | null;
  sia_licence_front_url: string | null;
  sia_licence_back_url: string | null;
  profile_completed: boolean | null;
  verification_status: string | null;
  certifications: string[] | null;
  sia_verified_at: string | null;
  sia_verification_status?: string | null;
  sia_verification_method?: string | null;
  sia_verification_notes?: string | null;
  sia_verification_verified?: boolean | null;
  sia_verification_name_match?: boolean | null;
  sia_verification_expiry_date?: string | null;
  sia_verification_sectors?: any | null;
}

export function computeSIAStatus(
  siaVerified: boolean,
  expiryDate: string | null,
  licenceNumber: string | null,
  licenceFrontUrl: string | null,
  verificationStatus: string | null
): SIAStatus {
  if (!licenceNumber && !licenceFrontUrl) return "missing";
  if (!siaVerified || verificationStatus === "pending" || verificationStatus === "rejected") return "pending";
  if (!expiryDate) return "unverified";

  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "expired";
  if (daysUntil <= 30) return "expiring_soon";
  return "valid";
}

export function computeComplianceInfo(
  guard: GuardComplianceData,
  requiredLicenceTypes?: string[] | null
): ComplianceInfo {
  const siaStatus = computeSIAStatus(
    guard.sia_verified,
    guard.sia_expiry_date,
    guard.sia_licence_number,
    guard.sia_licence_front_url,
    guard.verification_status
  );

  const statusLabels: Record<SIAStatus, string> = {
    valid: "Verified & Valid",
    expiring_soon: "Expiring Soon",
    expired: "Expired",
    missing: "Missing Licence",
    pending: "Pending Verification",
    unverified: "Unverified",
  };

  const attentionReasons: string[] = [];
  let score = 0;

  if (siaStatus === "valid") {
    score += 40;
  } else if (siaStatus === "expiring_soon") {
    score += 30;
    attentionReasons.push("SIA licence expires soon");
  } else if (siaStatus === "expired") {
    score += 10;
    attentionReasons.push("SIA licence has expired");
  } else if (siaStatus === "missing") {
    score += 0;
    attentionReasons.push("SIA licence is missing");
  } else if (siaStatus === "pending") {
    score += 15;
    attentionReasons.push("SIA verification is pending");
  } else {
    score += 20;
  }

  const profileCompleted = !!guard.profile_completed;
  if (profileCompleted) {
    score += 20;
  } else {
    attentionReasons.push("Profile is incomplete");
  }

  const hasLicenceFront = !!guard.sia_licence_front_url;
  const hasLicenceBack = !!guard.sia_licence_back_url;
  if (hasLicenceFront) score += 10;
  if (hasLicenceBack) score += 10;
  if (!hasLicenceFront && !hasLicenceBack && siaStatus !== "missing") {
    attentionReasons.push("Licence documents not uploaded");
  }

  const hasCertifications = !!guard.certifications && guard.certifications.length > 0;
  if (hasCertifications) score += 10;

  const rightToWork: "verified" | "pending" | "missing" = guard.sia_verified ? "verified" : guard.sia_licence_number ? "pending" : "missing";
  const insuranceStatus: "verified" | "pending" | "missing" = guard.certifications?.some((c) => c.toLowerCase().includes("insurance")) ? "verified" : "missing";
  const trainingStatus: "verified" | "pending" | "missing" = guard.certifications?.some((c) => c.toLowerCase().includes("training") || c.toLowerCase().includes("first aid")) ? "verified" : "missing";

  if (insuranceStatus === "missing") attentionReasons.push("Insurance certificate not on record");
  if (trainingStatus === "missing") attentionReasons.push("Training certificate not on record");

  if (rightToWork === "missing") {
    attentionReasons.push("Right-to-work verification incomplete");
  } else if (rightToWork === "pending") {
    attentionReasons.push("Right-to-work verification pending");
  }

  let licenceMatchStatus: "matched" | "mismatch" | "unknown" = "unknown";
  if (requiredLicenceTypes && requiredLicenceTypes.length > 0 && guard.licence_types) {
    const hasMatch = requiredLicenceTypes.some((req) =>
      guard.licence_types?.some((lic) => lic.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(lic.toLowerCase()))
    );
    licenceMatchStatus = hasMatch ? "matched" : "mismatch";
    if (licenceMatchStatus === "mismatch") {
      attentionReasons.push("Licence type does not match job requirements");
    }
  }

  if (siaStatus === "valid" && profileCompleted && licenceMatchStatus !== "mismatch") {
    score += 10;
  }

  const isFullyCompliant =
    siaStatus === "valid" &&
    profileCompleted &&
    licenceMatchStatus !== "mismatch" &&
    rightToWork !== "missing" &&
    insuranceStatus !== "missing";

  if (isFullyCompliant) score = Math.min(100, score + 10);

  const needsAttention = attentionReasons.length > 0;

  return {
    siaStatus,
    siaStatusLabel: statusLabels[siaStatus],
    siaExpiryDate: guard.sia_expiry_date,
    siaLicenceNumber: guard.sia_licence_number,
    siaLicenceTypes: guard.licence_types,
    siaVerified: guard.sia_verified,
    siaVerifiedAt: guard.sia_verified_at,
    siaLicenceFrontUrl: guard.sia_licence_front_url,
    siaLicenceBackUrl: guard.sia_licence_back_url,
    profileCompleted,
    verificationStatus: guard.verification_status,
    certifications: guard.certifications,
    rightToWork,
    insuranceStatus,
    trainingStatus,
    overallScore: Math.min(100, Math.max(0, score)),
    isFullyCompliant,
    needsAttention,
    attentionReasons,
    licenceMatchStatus,
    requiredLicenceTypes,
  };
}

export function formatSIAStatus(status: SIAStatus): {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
} {
  const map: Record<SIAStatus, { label: string; icon: string; color: string; bg: string; border: string }> = {
    valid: {
      label: "SIA Verified",
      icon: "ri-shield-check-line",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
    },
    expiring_soon: {
      label: "SIA Expiring Soon",
      icon: "ri-time-line",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
    },
    expired: {
      label: "SIA Expired",
      icon: "ri-error-warning-line",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/25",
    },
    missing: {
      label: "Missing Licence",
      icon: "ri-file-close-line",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/25",
    },
    pending: {
      label: "Pending Review",
      icon: "ri-loader-4-line",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/25",
    },
    unverified: {
      label: "Self-Submitted",
      icon: "ri-shield-user-line",
      color: "text-slate-400",
      bg: "bg-slate-500/10",
      border: "border-slate-500/25",
    },
  };
  return map[status];
}

export function getComplianceExplanation(compliance: ComplianceInfo): string {
  const { siaStatus, licenceMatchStatus } = compliance;

  if (licenceMatchStatus === "mismatch") {
    return "This guard does not currently match the required licence type for this job.";
  }

  switch (siaStatus) {
    case "valid":
      return "This guard's SIA licence is verified and valid.";
    case "expiring_soon":
      return "This guard's SIA licence expires soon. You may still select them, but review before confirming.";
    case "expired":
      return "This guard's SIA licence has expired. They should not be assigned until renewed.";
    case "missing":
      return "This guard has no SIA licence on record. Do not assign without valid documentation.";
    case "pending":
      return "This guard's SIA licence is awaiting admin verification. Status will update once reviewed.";
    case "unverified":
      return "This guard has submitted licence details but they have not been independently verified yet.";
    default:
      return "Compliance status unavailable.";
  }
}

export function getOverallBadge(compliance: ComplianceInfo): {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
} {
  if (compliance.isFullyCompliant) {
    return {
      label: "Fully Compliant",
      icon: "ri-shield-check-line",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
    };
  }
  if (compliance.siaStatus === "expired" || compliance.siaStatus === "missing") {
    return {
      label: "Needs Attention",
      icon: "ri-error-warning-line",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/25",
    };
  }
  if (compliance.siaStatus === "expiring_soon" || compliance.siaStatus === "pending") {
    return {
      label: "Needs Attention",
      icon: "ri-time-line",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
    };
  }
  if (compliance.licenceMatchStatus === "mismatch") {
    return {
      label: "Licence Mismatch",
      icon: "ri-file-warning-line",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/25",
    };
  }
  return {
    label: "Needs Attention",
    icon: "ri-information-line",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
  };
}