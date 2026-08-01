'use client';

interface Props {
  onSelect: (text: string) => void;
  onClose: () => void;
}

const templates = [
  {
    text: 'Please confirm your availability for this shift.',
    label: 'Confirm availability',
    icon: 'ri-calendar-check-line',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    text: 'Please upload or update your SIA licence details so we can verify your status.',
    label: 'Update SIA licence',
    icon: 'ri-shield-check-line',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    text: 'You have been selected for this job. Please confirm your acceptance as soon as possible.',
    label: 'Selected for job',
    icon: 'ri-user-star-line',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
  {
    text: 'Please confirm your expected arrival time at the venue.',
    label: 'Confirm arrival time',
    icon: 'ri-time-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    text: 'Thank you for your work on this job. It has been completed successfully.',
    label: 'Job completed',
    icon: 'ri-checkbox-circle-line',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    text: 'I need help from QuickGuard support regarding this job.',
    label: 'Contact support',
    icon: 'ri-customer-service-2-line',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
];

export default function MessageTemplates({ onSelect, onClose }: Props) {
  return (
    <div className="px-5 py-3 bg-[#162036]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-400">Quick Templates</p>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer">
          <i className="ri-close-line text-sm"></i>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => (
          <button
            key={t.label}
            onClick={() => onSelect(t.text)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${t.bg} ${t.border} border hover:brightness-110`}
          >
            <div className={`w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 ${t.bg}`}>
              <i className={`${t.icon} ${t.color} text-sm`}></i>
            </div>
            <span className={`${t.color} truncate`}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}