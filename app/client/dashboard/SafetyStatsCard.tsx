import Link from 'next/link';

interface SafetyStatsCardProps {
  missingSafetyInfo: number;
  highRiskJobs: number;
  complianceWarnings: number;
  missingEmergencyContacts: number;
  loading?: boolean;
}

export default function SafetyStatsCard({
  missingSafetyInfo,
  highRiskJobs,
  complianceWarnings,
  missingEmergencyContacts,
  loading = false,
}: SafetyStatsCardProps) {
  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6 animate-pulse">
        <div className="h-5 bg-[#1a2b4a] rounded w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-[#1a2b4a] rounded-xl" />
          <div className="h-16 bg-[#1a2b4a] rounded-xl" />
          <div className="h-16 bg-[#1a2b4a] rounded-xl" />
          <div className="h-16 bg-[#1a2b4a] rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Missing Safety Info',
      value: missingSafetyInfo,
      color: missingSafetyInfo > 0 ? 'text-amber-400' : 'text-emerald-400',
      bg: missingSafetyInfo > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/15',
      border: missingSafetyInfo > 0 ? 'border-amber-500/25' : 'border-emerald-500/25',
    },
    {
      label: 'High Risk Jobs',
      value: highRiskJobs,
      color: highRiskJobs > 0 ? 'text-red-400' : 'text-emerald-400',
      bg: highRiskJobs > 0 ? 'bg-red-500/15' : 'bg-emerald-500/15',
      border: highRiskJobs > 0 ? 'border-red-500/25' : 'border-emerald-500/25',
    },
    {
      label: 'Compliance Warnings',
      value: complianceWarnings,
      color: complianceWarnings > 0 ? 'text-orange-400' : 'text-emerald-400',
      bg: complianceWarnings > 0 ? 'bg-orange-500/15' : 'bg-emerald-500/15',
      border: complianceWarnings > 0 ? 'border-orange-500/25' : 'border-emerald-500/25',
    },
    {
      label: 'Missing Emergency Contacts',
      value: missingEmergencyContacts,
      color: missingEmergencyContacts > 0 ? 'text-violet-400' : 'text-emerald-400',
      bg: missingEmergencyContacts > 0 ? 'bg-violet-500/15' : 'bg-emerald-500/15',
      border: missingEmergencyContacts > 0 ? 'border-violet-500/25' : 'border-emerald-500/25',
    },
  ];

  const hasIssues = missingSafetyInfo > 0 || highRiskJobs > 0 || complianceWarnings > 0 || missingEmergencyContacts > 0;

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ri-shield-check-line text-teal-400 text-lg" />
          <h2 className="text-base font-semibold text-white">Trust & Safety</h2>
        </div>
        {hasIssues && (
          <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/25">
            Action Needed
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`p-3 rounded-xl border ${s.bg} ${s.border} transition-all`}
          >
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 leading-tight mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Link
        href="/client/trust-safety"
        className="flex items-center justify-center gap-2 w-full py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer"
      >
        <i className="ri-shield-check-line" />
        Open Trust & Safety Centre
      </Link>
    </div>
  );
}