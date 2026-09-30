'use client';

interface StatusCardProps {
  icon: string;
  tone: 'teal' | 'green' | 'amber' | 'red';
  title: string;
  children: React.ReactNode;
}

const TONES: Record<string, string> = {
  teal: 'bg-teal-500/15 text-teal-400',
  green: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
};

export default function StatusCard({ icon, tone, title, children }: StatusCardProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-[#111d35] border border-[#1e2d4d] rounded-3xl p-7 text-center shadow-xl shadow-black/20">
      <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${TONES[tone]}`}>
        <i className={`${icon} text-3xl w-8 h-8 flex items-center justify-center`}></i>
      </div>
      <h1 className="text-lg font-bold text-white mb-2">{title}</h1>
      {children}
    </div>
  );
}