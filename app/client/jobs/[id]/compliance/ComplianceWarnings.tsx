"use client";

import { ComplianceInfo } from "./useCompliance";

interface Props {
  complianceList: ComplianceInfo[];
  guardNames?: string[];
  guardsRequired?: number;
  guardsSelected?: number;
  requiredLicenceTypes?: string[] | null;
}

export default function ComplianceWarnings({
  complianceList,
  guardNames = [],
  guardsRequired = 0,
  guardsSelected = 0,
  requiredLicenceTypes,
}: Props) {
  const warnings: { type: string; message: string; guardName?: string; severity: "critical" | "warning" | "info" }[] = [];

  complianceList.forEach((comp, idx) => {
    const name = guardNames[idx] || "Guard";
    if (comp.siaStatus === "expired") {
      warnings.push({
        type: "expired_sia",
        message: `${name}'s SIA licence has expired.`,
        guardName: name,
        severity: "critical",
      });
    } else if (comp.siaStatus === "missing") {
      warnings.push({
        type: "missing_sia",
        message: `${name} has no SIA licence on record.`,
        guardName: name,
        severity: "critical",
      });
    } else if (comp.siaStatus === "expiring_soon") {
      const days = comp.siaExpiryDate
        ? Math.ceil((new Date(comp.siaExpiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      warnings.push({
        type: "near_expiry_sia",
        message: `${name}'s SIA licence expires in ${days} day${days !== 1 ? "s" : ""}.`,
        guardName: name,
        severity: "warning",
      });
    } else if (comp.siaStatus === "pending") {
      warnings.push({
        type: "pending_sia",
        message: `${name}'s SIA licence is pending admin verification.`,
        guardName: name,
        severity: "warning",
      });
    }

    if (comp.licenceMatchStatus === "mismatch") {
      warnings.push({
        type: "licence_mismatch",
        message: `${name} does not have the required licence type for this job.`,
        guardName: name,
        severity: "warning",
      });
    }

    if (!comp.profileCompleted) {
      warnings.push({
        type: "incomplete_profile",
        message: `${name}'s profile is incomplete.`,
        guardName: name,
        severity: "info",
      });
    }
  });

  if (guardsRequired > 0 && guardsSelected < guardsRequired) {
    warnings.push({
      type: "understaffed",
      message: `You have selected ${guardsSelected} of ${guardsRequired} required guards.`,
      severity: "warning",
    });
  }

  if (warnings.length === 0) return null;

  const critical = warnings.filter((w) => w.severity === "critical");
  const other = warnings.filter((w) => w.severity !== "critical");

  return (
    <div className="space-y-2">
      {critical.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-error-warning-line text-red-400 text-lg"></i>
            <h4 className="text-sm font-bold text-red-400">Critical Compliance Issues</h4>
            <span className="ml-auto bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold">
              {critical.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {critical.map((w, i) => (
              <li key={i} className="text-sm text-red-400 flex items-start gap-2">
                <i className="ri-close-circle-line mt-0.5 text-xs"></i>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {other.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-time-line text-amber-400 text-lg"></i>
            <h4 className="text-sm font-bold text-amber-400">Compliance Warnings</h4>
            <span className="ml-auto bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs font-bold">
              {other.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {other.map((w, i) => (
              <li key={i} className="text-sm text-amber-400 flex items-start gap-2">
                <i className="ri-alert-line mt-0.5 text-xs"></i>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}