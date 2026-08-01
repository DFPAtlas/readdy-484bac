'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { hasFeature, CLIENT_FEATURE_KEYS, getAllClientFeatures } from '@/lib/entitlements';
import { useSidebar } from '@/lib/SidebarContext';
import type React from 'react';
import NotificationBadge from '@/components/NotificationBadge';

interface PortalSidebarProps {
  role: 'client' | 'guard' | 'company';
  displayName: string;
  subtitle: string;
  initials: string;
  accentColor?: string;
  featureFlags?: Record<string, boolean>;
  onUpgradeRequest?: (featureName: string) => void;
  userId?: string | null;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

interface NavItem {
  href: string;
  icon: string;
  label: string;
  featureRequired?: string;
}

const CLIENT_NAV: NavItem[] = [
  { href: '/client/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { href: '/client/post-job', icon: 'ri-add-circle-line', label: 'Post a Job', featureRequired: 'client.post_job' },
  { href: '/client/jobs', icon: 'ri-briefcase-line', label: 'My Jobs' },
  { href: '/client/job-history', icon: 'ri-history-line', label: 'Job History', featureRequired: 'client.job_history' },
  { href: '/client/jobs/tracker', icon: 'ri-radar-line', label: 'Job Tracker', featureRequired: 'client.job_tracker' },
  { href: '/client/templates', icon: 'ri-file-copy-line', label: 'Templates', featureRequired: 'client.job_templates' },
  { href: '/client/advanced-matching', icon: 'ri-user-search-line', label: 'Advanced Matching', featureRequired: 'client.advanced_matching' },
  { href: '/client/team-access', icon: 'ri-team-line', label: 'Team Access', featureRequired: 'client.team_access' },
  { href: '/client/sites', icon: 'ri-building-line', label: 'Saved Sites', featureRequired: 'client.multi_site' },
  { href: '/client/bulk-posting', icon: 'ri-stack-line', label: 'Bulk Posting', featureRequired: 'client.bulk_posting' },
  { href: '/client/messages', icon: 'ri-message-3-line', label: 'Messages', featureRequired: 'client.direct_contact' },
  { href: '/client/notifications', icon: 'ri-notification-3-line', label: 'Notifications' },
  { href: '/client/payment-centre', icon: 'ri-wallet-3-line', label: 'Payment Centre' },
  { href: '/client/reviews', icon: 'ri-star-line', label: 'Reviews' },
  { href: '/client/trust-safety', icon: 'ri-shield-check-line', label: 'Trust & Safety' },
  { href: '/client/reports', icon: 'ri-file-chart-line', label: 'Reports', featureRequired: 'client.analytics_dashboard' },
  { href: '/client/activity-log', icon: 'ri-history-line', label: 'Activity Log', featureRequired: 'client.analytics_dashboard' },
  { href: '/client/profile', icon: 'ri-user-settings-line', label: 'Profile & Settings' },
  { href: '/client/profile?tab=data', icon: 'ri-database-2-line', label: 'Data & Privacy' },
  { href: '/client/help', icon: 'ri-question-answer-line', label: 'Help Centre' },
  { href: '/client/rewards', icon: 'ri-coins-line', label: 'QG Rewards' },
];

const GUARD_NAV = [
  { href: '/guard/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { href: '/guard/jobs', icon: 'ri-briefcase-line', label: 'Find Jobs' },
  { href: '/guard/job-history', icon: 'ri-history-line', label: 'Job History' },
  { href: '/guard/payment-centre', icon: 'ri-money-pound-circle-line', label: 'Payment Centre' },
  { href: '/guard/profile', icon: 'ri-user-settings-line', label: 'Profile' },
  { href: '/guard/bank-settings', icon: 'ri-bank-card-line', label: 'Bank Settings' },
  { href: '/guard/notifications', icon: 'ri-notification-3-line', label: 'Notifications' },
  { href: '/guard/rewards', icon: 'ri-coins-line', label: 'QG Rewards' },
];

const COMPANY_NAV = [
  { href: '/company/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { href: '/company/sites', icon: 'ri-building-4-line', label: 'Sites' },
  { href: '/company/staff', icon: 'ri-team-line', label: 'Staff' },
  { href: '/company/rotas', icon: 'ri-calendar-check-line', label: 'Rotas' },
  { href: '/company/incidents', icon: 'ri-alert-line', label: 'Incidents' },
  { href: '/company/compliance', icon: 'ri-shield-check-line', label: 'Compliance' },
  { href: '/company/training', icon: 'ri-book-open-line', label: 'Training' },
  { href: '/company/reports', icon: 'ri-file-chart-line', label: 'Reports' },
  { href: '/company/billing', icon: 'ri-bank-card-line', label: 'Billing' },
  { href: '/company/messages', icon: 'ri-message-3-line', label: 'Messages' },
  { href: '/company/settings', icon: 'ri-settings-3-line', label: 'Settings' },
];

export default function PortalSidebar({
  role,
  displayName,
  subtitle,
  initials,
  accentColor = 'teal',
  featureFlags: explicitFlags,
  onUpgradeRequest,
  userId,
  collapsible = true,
  onToggle,
}: PortalSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [internalFlags, setInternalFlags] = useState<Record<string, boolean>>();
  const [flagsLoaded, setFlagsLoaded] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useSafeRouter();

  const navItems = role === 'client' ? CLIENT_NAV : role === 'company' ? COMPANY_NAV : GUARD_NAV;
  const isActive = (href: string) => pathname === href;

  const mergedFlags: Record<string, boolean> = { ...internalFlags, ...explicitFlags };

  useEffect(() => {
    if (role !== 'client') {
      setFlagsLoaded(true);
      return;
    }
    if (explicitFlags && Object.keys(explicitFlags).length > 0) {
      setFlagsLoaded(true);
      return;
    }

    let mounted = true;
    const loadFlags = async () => {
      let uid = userId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id;
      }
      if (!uid) {
        if (mounted) setFlagsLoaded(true);
        return;
      }

      try {
        const flags = await getAllClientFeatures(uid);
        if (mounted) {
          setInternalFlags(flags);
          setFlagsLoaded(true);
        }
      } catch {
        if (mounted) setFlagsLoaded(true);
      }
    };

    loadFlags();
    return () => { mounted = false; };
  }, [role, userId, explicitFlags]);

  const handleToggle = () => {
    toggleSidebar();
    onToggle?.();
  };

  const isLocked = (item: NavItem): boolean => {
    if (!item.featureRequired) return false;
    if (!flagsLoaded) return false;
    return mergedFlags[item.featureRequired] === false;
  };

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (isLocked(item)) {
      e.preventDefault();
      onUpgradeRequest?.(item.label);
    }
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(role === 'client' ? '/client/login' : role === 'company' ? '/company/login' : '/guard/login');
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-72';

  const sidebarContent = (
    <>
      <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-[#1a2b4a]">
        <span className="text-white font-bold text-sm">Menu</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] cursor-pointer"
        >
          <i className="ri-close-line text-lg text-slate-400"></i>
        </button>
      </div>

      <div className={`border-b border-[#1a2b4a] ${collapsed ? 'px-2 py-4' : 'px-5 py-5'}`}>
        <Link href="/" prefetch={false} className={`flex items-center gap-2.5 mb-5 outline-none ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
            <i className="ri-shield-check-line text-white text-lg"></i>
          </div>
          {!collapsed && (
            <span className="text-white text-lg font-bold font-[family-name:var(--font-pacifico)] tracking-wide">QuickGuard</span>
          )}
        </Link>

        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className={`${collapsed ? 'w-10 h-10' : 'w-11 h-11'} rounded-full ${accentColor === 'emerald' ? 'bg-emerald-600' : 'bg-teal-600'} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-white/10`}>
            {collapsed ? initials.slice(0, 1) : initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{displayName}</p>
              <span className={`text-xs ${accentColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-teal-500/15 text-teal-300'} px-2 py-0.5 rounded-full font-medium border ${accentColor === 'emerald' ? 'border-emerald-500/25' : 'border-teal-500/25'}`}>
                {subtitle}
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          const locked = isLocked(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={(e) => handleNavClick(e, item)}
              className={`flex items-center rounded-lg transition-all cursor-pointer outline-none group ${
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
              } ${
                active
                  ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20 font-semibold'
                  : locked
                    ? 'text-slate-600 hover:bg-[#1a2b4a]/50 hover:text-slate-500'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${active ? 'text-teal-400' : locked ? 'text-slate-600' : 'text-slate-500'}`}>
                <i className={`${item.icon} text-base`}></i>
              </div>
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 whitespace-nowrap">{item.label}</span>
                  {item.label === 'Notifications' && (
                    <NotificationBadge userId={userId} userType={role === 'client' ? 'client' : role === 'guard' ? 'guard' : undefined} />
                  )}
                  {locked && (
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0" title="Upgrade required">
                      <i className="ri-lock-line text-xs text-slate-600 group-hover:text-amber-500 transition-colors"></i>
                    </div>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-[#1a2b4a] py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'}`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-logout-box-r-line text-base"></i>
          </div>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 bg-[#111d35] rounded-xl shadow-lg border border-[#1a2b4a] flex items-center justify-center cursor-pointer"
      >
        <i className="ri-menu-line text-lg text-slate-300"></i>
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`${mobileOpen ? 'flex' : 'hidden'} lg:flex ${sidebarWidth} min-h-screen bg-[#0B1933] flex-col fixed left-0 top-0 z-30 border-r border-[#1a2b4a] overflow-y-auto transition-all duration-300`}>
        {collapsible && (
          <button
            onClick={handleToggle}
            className="hidden lg:flex absolute top-3 right-3 z-40 w-7 h-7 bg-[#162036] border border-[#1e2d4d] rounded-lg items-center justify-center cursor-pointer hover:bg-[#1a2b4a] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`ri-arrow-left-s-line text-sm text-slate-400 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}></i>
          </button>
        )}
        {sidebarContent}
      </aside>
    </>
  );
}