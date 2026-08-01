"use client";

import { ComplianceInfo, formatSIAStatus, getOverallBadge } from "./useCompliance";

interface Props {
  compliance: ComplianceInfo;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

export default function GuardComplianceBadge({ compliance, size = "sm", showScore = false }: Props) {
  const badge = getOverallBadge(compliance);
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1 text-sm",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${badge.bg} ${badge.color} ${badge.border} ${sizeClasses[size]} rounded-full font-medium whitespace-nowrap border flex items-center gap-1`}
      >
        <i className={badge.icon}></i>
        {badge.label}
      </span>
      {showScore && (
        <span className="text-xs text-slate-500 font-medium">
          {compliance.overallScore}% score
        </span>
      )}
    </div>
  );
}

export function SIAStatusBadge({ compliance, size = "sm" }: { compliance: ComplianceInfo; size?: "sm" | "md" }) {
  const style = formatSIAStatus(compliance.siaStatus);
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`${style.bg} ${style.color} ${style.border} ${sizeClasses[size]} rounded-full font-medium whitespace-nowrap border flex items-center gap-1`}
    >
      <i className={style.icon}></i>
      {style.label}
    </span>
  );
}

export function ComplianceScoreRing({ score, size = 32 }: { score: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e2d4d"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-300">{score}</span>
    </div>
  );
}