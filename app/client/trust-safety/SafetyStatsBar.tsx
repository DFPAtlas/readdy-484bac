import Link from 'next/link';

interface SafetyCounts {
  totalJobs: number;
  missingSafetyInfo: number;
  highRiskJobs: number;
  complianceWarnings: number;
  missingEmergencyContacts: number;
  missingSiteInstructions: number;
  jobsWithSIARequired: number;
  jobsLoneWorker: number;
  jobsWithIncidents: number;
  openTickets: number;
  urgentTickets: number;
}

interface SafetyStatsBarProps {
  counts: SafetyCounts;
  onTabChange: (tab: string) => void;
}

export default function SafetyStatsBar({ counts, onTabChange }: SafetyStatsBarProps) {
  const stats = [
    {
      label: 'Total Jobs',
      value: counts.totalJobs,
      icon: 'ri-briefcase-4-line',
      color: 'text-blue-400',
      bg: 'bg-blue-500/15',
      border: 'border-blue-500/25',
    },
    {
      label: 'Missing Safety Info',
      value: counts.missingSafetyInfo,
      icon: 'ri-error-warning-line',
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/25',
      warning: counts.missingSafetyInfo > 0,
      onClick: () => onTabChange('checklist'),
    },
    {
      label: 'High Risk Jobs',
      value: counts.highRiskJobs,
      icon: 'ri-alert-line',
      color: 'text-red-400',
      bg: 'bg-red-500/15',
      border: 'border-red-500/25',
      warning: counts.highRiskJobs > 0,
      onClick: () => onTabChange('checklist'),
    },
    {
      label: 'Compliance Warnings',
      value: counts.complianceWarnings,
      icon: 'ri-error-warning-line',
      color: 'text-orange-400',
      bg: 'bg-orange-500/15',
      border: 'border-orange-500/25',
      warning: counts.complianceWarnings > 0,
      onClick: () => onTabChange('compliance'),
    },
    {
      label: 'Missing Emergency Contacts',
      value: counts.missingEmergencyContacts,
      icon: 'ri-phone-line',
      color: 'text-violet-400',
      bg: 'bg-violet-500/15',
      border: 'border-violet-500/25',
      warning: counts.missingEmergencyContacts > 0,
      onClick: () => onTabChange('contacts'),
    },
    {
      label: 'Open Incidents',
      value: counts.openTickets,
      icon: 'ri-flashlight-line',
      color: 'text-rose-400',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/25',
      warning: counts.openTickets > 0,
      onClick: () => onTabChange('incidents'),
    },
    {
      label: 'Lone Worker',
      value: counts.jobsLoneWorker,
      icon: 'ri-user-location-line',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15',
      border: 'border-cyan-500/25',
      onClick: () => onTabChange('checklist'),
    },
    {
      label: 'SIA Required',
      value: counts.jobsWithSIARequired,
      icon: 'ri-shield-check-line',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/25',
      onClick: () => onTabChange('checklist'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => {
        const clickable = s.onClick;
        const Wrapper = clickable ? 'button' : 'div';
        return (
          <Wrapper
            key={s.label}
            onClick={s.onClick}
            className={`relative bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 shadow-sm transition-all ${
              clickable ? 'hover:shadow-md cursor-pointer hover:dark:bg-[#162036]' : ''
            } ${s.warning ? 'ring-1 ring-red-500/20' : ''}`}
          >
            {s.warning && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2 border ${s.border}`}>
              <i className={`${s.icon} ${s.color} text-lg`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{s.label}</p>
          </Wrapper>
        );
      })}
    </div>
  );
}