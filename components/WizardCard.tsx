'use client';

interface WizardCardProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  description?: string;
}

export default function WizardCard({ title, icon, children, description }: WizardCardProps) {
  return (
    <div className="bg-[#111d35] rounded-xl p-8 shadow-xl border border-slate-700/50 mb-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 flex items-center justify-center bg-teal-500/15 rounded-xl flex-shrink-0">
          <i className={`${icon} text-2xl text-teal-400`}></i>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
          {description && (
            <p className="text-slate-400 text-sm">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
