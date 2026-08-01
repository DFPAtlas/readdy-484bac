'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  companyName: string;
  subscriptionTier: string;
  initials: string;
}

const navItems = [
  { href: '/client/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { href: '/client/post-job', icon: 'ri-add-circle-line', label: 'Post a Job' },
  { href: '/client/jobs', icon: 'ri-briefcase-line', label: 'My Jobs' },
  { href: '/client/jobs/tracker', icon: 'ri-radar-line', label: 'Job Tracker' },
  { href: '/client/payment-centre', icon: 'ri-wallet-3-line', label: 'Payment Centre' },
  { href: '/client/complaints', icon: 'ri-feedback-line', label: 'Complaints' },
  { href: '/client/profile', icon: 'ri-user-settings-line', label: 'Profile & Settings' },
];

export default function DashboardSidebar({ companyName, subscriptionTier, initials }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/client/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-[#0B1933] flex flex-col fixed left-0 top-0 z-30 border-r border-[#1a2b4a]">
      <div className="px-6 py-6 border-b border-[#1a2b4a]">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
            <i className="ri-shield-check-line text-white text-lg"></i>
          </div>
          <span className="text-white text-lg font-bold font-[family-name:var(--font-pacifico)]">QuickGuard</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{companyName}</p>
            <span className="text-xs bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded-full font-medium border border-teal-500/25">
              {subscriptionTier}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                  : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${item.icon} text-base`}></i>
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[#1a2b4a]">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-logout-box-r-line text-base"></i>
          </div>
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
