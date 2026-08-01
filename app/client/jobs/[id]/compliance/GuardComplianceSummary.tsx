"use client";

import { ComplianceInfo, formatSIAStatus, getComplianceExplanation, getOverallBadge } from "./useCompliance";

interface Props {
  compliance: ComplianceInfo;
  compact?: boolean;
}

export default function GuardComplianceSummary({ compliance, compact = false }: Props) {
  const badge = getOverallBadge(compliance);
  const siaStyle = formatSIAStatus(compliance.siaStatus);
  const explanation = getComplianceExplanation(compliance);

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`${badge.bg} ${badge.color} ${badge.border} px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1`}>
          <i className={badge.icon}></i>
          {badge.label}
        </span>
        {compliance.siaLicenceNumber && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <i className="ri-shield-check-line text-emerald-400"></i>
            SIA {compliance.siaLicenceNumber}
          </span>
        )}
        {compliance.siaExpiryDate && (
          <span className={`text-xs flex items-center gap-1 ${compliance.siaStatus === "expired" ? "text-red-400" : compliance.siaStatus === "expiring_soon" ? "text-amber-400" : "text-slate-500"}`}>
            <i className="ri-calendar-line"></i>
            Expires {new Date(compliance.siaExpiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        {compliance.licenceMatchStatus === "mismatch" && (
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
            <i className="ri-file-warning-line"></i>
            Licence mismatch
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-shield-check-line text-teal-400"></i>
          <h4 className="text-sm font-semibold text-slate-200">Compliance Summary</h4>
        </div>
        <span className={`${badge.bg} ${badge.color} ${badge.border} px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1`}>
          <i className={badge.icon}></i>
          {badge.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-slate-500">Overall Score</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-[#1e2d4d] rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  compliance.overallScore >= 80
                    ? "bg-emerald-400"
                    : compliance.overallScore >= 50
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${compliance.overallScore}%` }}
              ></div>
            </div>
            <span className="text-sm font-bold text-slate-200">{compliance.overallScore}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
          <i className={`${siaStyle.icon} ${siaStyle.color} text-sm`}></i>
          <div>
            <p className="text-xs text-slate-500">SIA Status</p>
            <p className={`text-xs font-semibold ${siaStyle.color}`}>{siaStyle.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
          <i className={`ri-user-line ${compliance.profileCompleted ? "text-emerald-400" : "text-red-400"} text-sm`}></i>
          <div>
            <p className="text-xs text-slate-500">Profile</p>
            <p className={`text-xs font-semibold ${compliance.profileCompleted ? "text-emerald-400" : "text-red-400"}`}>
              {compliance.profileCompleted ? "Complete" : "Incomplete"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
          <i className={`ri-passport-line ${compliance.rightToWork === "verified" ? "text-emerald-400" : compliance.rightToWork === "pending" ? "text-amber-400" : "text-red-400"} text-sm`}></i>
          <div>
            <p className="text-xs text-slate-500">Right to Work</p>
            <p className={`text-xs font-semibold capitalize ${compliance.rightToWork === "verified" ? "text-emerald-400" : compliance.rightToWork === "pending" ? "text-amber-400" : "text-red-400"}`}>
              {compliance.rightToWork}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-[#111d35] rounded-lg border border-[#1e2d4d]">
          <i className={`ri-file-shield-line ${compliance.insuranceStatus === "verified" ? "text-emerald-400" : "text-amber-400"} text-sm`}></i>
          <div>
            <p className="text-xs text-slate-500">Insurance</p>
            <p className={`text-xs font-semibold capitalize ${compliance.insuranceStatus === "verified" ? "text-emerald-400" : "text-amber-400"}`}>
              {compliance.insuranceStatus === "missing" ? "Not on record" : compliance.insuranceStatus}
            </p>
          </div>
        </div>
      </div>

      {compliance.siaLicenceNumber && (
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500">Licence Number:</span>
          <span className="text-slate-300 font-mono">{compliance.siaLicenceNumber}</span>
        </div>
      )}

      {compliance.siaLicenceTypes && compliance.siaLicenceTypes.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">SIA Licence Types</p>
          <div className="flex flex-wrap gap-1">
            {compliance.siaLicenceTypes.map((lic, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded text-xs border font-medium ${
                  compliance.requiredLicenceTypes?.some((req) =>
                    lic.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(lic.toLowerCase())
                  )
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                    : "bg-[#111d35] text-slate-400 border-[#1e2d4d]"
                }`}
              >
                <i className="ri-shield-check-line mr-0.5"></i>
                {lic}
                {compliance.requiredLicenceTypes?.some((req) =>
                  lic.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(lic.toLowerCase())
                ) && (
                  <i className="ri-check-line ml-0.5 text-emerald-400"></i>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {compliance.licenceMatchStatus === "mismatch" && compliance.requiredLicenceTypes && (
        <div className="bg-orange-500/10 border border-orange-500/25 rounded-lg p-3">
          <p className="text-sm text-orange-400 font-medium flex items-center gap-2">
            <i className="ri-file-warning-line"></i>
            Licence Type Mismatch
          </p>
          <p className="text-xs text-orange-300/80 mt-1">
            This job requires: {compliance.requiredLicenceTypes.join(", ")}
          </p>
        </div>
      )}

      <div className={`rounded-lg p-3 text-sm ${
        compliance.siaStatus === "valid"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
          : compliance.siaStatus === "expiring_soon"
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
          : "bg-red-500/10 text-red-400 border border-red-500/25"
      }`}>
        <i className={`${compliance.siaStatus === "valid" ? "ri-check-line" : "ri-error-warning-line"} mr-1.5`}></i>
        {explanation}
      </div>

      {compliance.needsAttention && compliance.attentionReasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-medium">Attention Needed:</p>
          {compliance.attentionReasons.map((reason, i) => (
            <p key={i} className="text-xs text-red-400 flex items-center gap-1">
              <i className="ri-error-warning-line text-[10px]"></i>
              {reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}