"use client";

import { useRouter } from "next/navigation";

const actions = [
  { label: 'Post Job', icon: 'ri-add-circle-line', color: 'bg-teal-500 text-white', href: '/client/post-job' },
  { label: 'My Jobs', icon: 'ri-briefcase-4-line', color: 'bg-blue-500 text-white', href: '/client/jobs' },
  { label: 'Templates', icon: 'ri-file-copy-line', color: 'bg-indigo-500 text-white', href: '/client/templates' },
  { label: 'Sites', icon: 'ri-building-line', color: 'bg-cyan-600 text-white', href: '/client/sites' },
  { label: 'Setup', icon: 'ri-rocket-line', color: 'bg-indigo-500 text-white', href: '/client/profile' },
  { label: 'Safety', icon: 'ri-shield-check-line', color: 'bg-teal-600 text-white', href: '/client/trust-safety' },
  { label: 'Payments', icon: 'ri-wallet-3-line', color: 'bg-violet-500 text-white', href: '/client/payment-history' },
  { label: 'Reports', icon: 'ri-file-chart-line', color: 'bg-cyan-500 text-white', href: '/client/reports' },
  { label: 'Messages', icon: 'ri-message-3-line', color: 'bg-sky-500 text-white', href: '/client/messages' },
  { label: 'Support', icon: 'ri-customer-service-2-line', color: 'bg-amber-500 text-white', href: '/client/support' },
];

export default function MobileQuickActions() {
  const router = useRouter();

  return (
    <div className="lg:hidden grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => router.push(a.href)}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#111d35] border border-[#1e2d4d] shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
        >
          <div className={`w-10 h-10 ${a.color} rounded-lg flex items-center justify-center`}>
            <i className={`${a.icon} text-lg`} />
          </div>
          <span className="text-[10px] font-semibold text-slate-300 text-center leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}