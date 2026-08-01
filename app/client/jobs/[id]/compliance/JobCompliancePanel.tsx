"use client";

import { ComplianceInfo } from "./useCompliance";

interface Props {
  guardsRequired: number;
  guardsSelected: number;
  compliantCount: number;
  needsReviewCount: number;
  requiredLicenceTypes?: string[] | null;
  selectedGuardsCompliance: ComplianceInfo[];
}

export default function JobCompliancePanel({
  guardsRequired,
  guardsSelected,
  compliantCount,
  needsReviewCount,
  requiredLicenceTypes,
  selectedGuardsCompliance,
}: Props) {
  const allCompliant = guardsSelected > 0 && needsReviewCount === 0 && guardsSelected >= guardsRequired;
  const understaffed = guardsSelected < guardsRequired;
  const jobStatus = allCompliant ? "compliant" : understaffed ? "understaffed" : needsReviewCount > 0 ? "needs_review" : "incomplete";

  const statusConfig = {
    compliant: {
      label: "Fully Compliant",
      icon: "ri-shield-check-line",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
      barColor: "bg-emerald-400",
    },
    understaffed: {
      label: "Understaffed",
      icon: "ri-user-unfollow-line",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      barColor: "bg-amber-400",
    },
    needs_review: {
      label: "Needs Review",
      icon: "ri-error-warning-line",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/25",
      barColor: "bg-red-400",
    },
    incomplete: {
      label: "Incomplete",
      icon: "ri-time-line",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/25",
      barColor: "bg-blue-400",
    },
  };

  const status = statusConfig[jobStatus];

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-shield-check-line text-teal-400"></i>
          <h3 className="text-sm font-bold text-white">Job Compliance</h3>
        </div>
        <span className={`${status.bg} ${status.color} ${status.border} px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1`}>
          <i className={status.icon}></i>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d] text-center">
          <p className="text-2xl font-bold text-slate-200">{guardsRequired}</p>
          <p className="text-xs text-slate-500 mt-0.5">Guards Required</p>
        </div>
        <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d] text-center">
          <p className="text-2xl font-bold text-teal-400">{guardsSelected}</p>
          <p className="text-xs text-slate-500 mt-0.5">Guards Selected</p>
        </div>
        <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d] text-center">
          <p className="text-2xl font-bold text-emerald-400">{compliantCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Fully Compliant</p>
        </div>
        <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d] text-center">
          <p className="text-2xl font-bold text-red-400">{needsReviewCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Needs Review</p>
        </div>
      </div>

      {requiredLicenceTypes && requiredLicenceTypes.length > 0 && (
        <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
          <p className="text-xs text-slate-500 mb-2">Required Licence Types</p>
          <div className="flex flex-wrap gap-1">
            {requiredLicenceTypes.map((lic, i) => (
              <span
                key={i}
                className="bg-teal-500/10 text-teal-400 border border-teal-500/25 px-2 py-0.5 rounded text-xs font-medium"
              >
                <i className="ri-shield-check-line mr-0.5"></i>
                {lic}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500">Compliance Progress</span>
          <span className="text-slate-300 font-semibold">
            {guardsSelected}/{guardsRequired}
          </span>
        </div>
        <div className="bg-[#1e2d4d] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${status.barColor}`}
            style={{ width: `${guardsRequired > 0 ? Math.min(100, (guardsSelected / guardsRequired) * 100) : 0}%` }}
          ></div>
        </div>
      </div>

      {guardsSelected > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Selected Guard Compliance</p>
          <div className="space-y-2">
            {selectedGuardsCompliance.map((comp, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 bg-[#1e2d4d] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      comp.overallScore >= 80
                        ? "bg-emerald-400"
                        : comp.overallScore >= 50
                        ? "bg-amber-400"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${comp.overallScore}%` }}
                  ></div>
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{comp.overallScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {understaffed && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
          <p className="text-sm text-amber-400 font-medium flex items-center gap-2">
            <i className="ri-user-unfollow-line"></i>
            Understaffed
          </p>
          <p className="text-xs text-amber-300/80 mt-1">
            You need {guardsRequired - guardsSelected} more guard{guardsRequired - guardsSelected !== 1 ? "s" : ""} to meet the job requirements.
          </p>
        </div>
      )}

      {needsReviewCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3">
          <p className="text-sm text-red-400 font-medium flex items-center gap-2">
            <i className="ri-error-warning-line"></i>
            Compliance Issues Found
          </p>
          <p className="text-xs text-red-300/80 mt-1">
            {needsReviewCount} selected guard{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""} attention before confirming.
          </p>
        </div>
      )}

      {allCompliant && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3">
          <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
            <i className="ri-check-double-line"></i>
            All Guards Compliant
          </p>
          <p className="text-xs text-emerald-300/80 mt-1">
            All selected guards meet the job requirements and have valid licences.
          </p>
        </div>
      )}
    </div>
  );
}