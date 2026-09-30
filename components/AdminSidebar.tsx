'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAdminAuth, clearAdminAuthCache } from '@/hooks/useAdminAuth';

interface BadgeCounts {
  failedPayments: number;
  guardVerifications: number;
  siaVerifications: number;
  heldPayments: number;
  complaints: number;
  contactSubmissions: number;
}

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: ReactNode;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

interface FlyoutState {
  label: string;
  top: number;
}

const COLLAPSED_WIDTH = 72;
const COLLAPSED_STORAGE_KEY = 'qg-admin-sidebar-collapsed';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useSafeRouter();
  const adminUser = useAdminAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<BadgeCounts>({
    failedPayments: 0,
    guardVerifications: 0,
    siaVerifications: 0,
    heldPayments: 0,
    complaints: 0,
    contactSubmissions: 0,
  });
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);

  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === 'true');
    } catch {
      // Preference is optional.
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch {
      // Preference is optional.
    }
  }, [collapsed]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(`${href}/`));

  const Badge = ({ count, color = 'red' }: { count: number; color?: 'red' | 'yellow' }) => {
    if (count === 0) return null;
    const cls = color === 'red'
      ? 'bg-red-500 text-white'
      : 'bg-amber-400 text-slate-900';

    return (
      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full leading-none tabular-nums ${cls}`}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const groups = useMemo<NavGroup[]>(() => [
    {
      label: 'Overview',
      icon: 'ri-dashboard-3-line',
      items: [
        { href: '/admin/dashboard', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
        { href: '/admin/activity-log', icon: 'ri-history-line', label: 'Activity' },
        { href: '/admin/live-test-checklist', icon: 'ri-flask-line', label: 'Launch & UAT' },
      ],
    },
    {
      label: 'People',
      icon: 'ri-team-line',
      items: [
        { href: '/admin/accounts', icon: 'ri-team-line', label: 'Accounts' },
        {
          href: '/admin/guard-verifications',
          icon: 'ri-shield-check-line',
          label: 'Verifications',
          badge: <Badge count={badges.guardVerifications + badges.siaVerifications} color="yellow" />,
        },
        { href: '/admin/reviews', icon: 'ri-star-line', label: 'Reviews' },
        { href: '/admin/user-provisioning', icon: 'ri-user-settings-line', label: 'Provisioning' },
      ],
    },
    {
      label: 'Jobs',
      icon: 'ri-briefcase-line',
      items: [
        { href: '/admin/jobs', icon: 'ri-briefcase-line', label: 'Jobs & Bookings' },
      ],
    },
    {
      label: 'Payments',
      icon: 'ri-money-pound-circle-line',
      items: [
        { href: '/admin/payments', icon: 'ri-secure-payment-line', label: 'Payments' },
        { href: '/admin/platform-finances', icon: 'ri-pie-chart-line', label: 'Finance' },
        {
          href: '/admin/failed-payments',
          icon: 'ri-error-warning-line',
          label: 'Exceptions',
          badge: <Badge count={badges.failedPayments + badges.heldPayments} color="red" />,
        },
      ],
    },
    {
      label: 'Subscriptions',
      icon: 'ri-bank-card-line',
      items: [
        { href: '/admin/subscription-management', icon: 'ri-bank-card-line', label: 'Subscriptions' },
        { href: '/admin/plan-fee-rules', icon: 'ri-settings-3-line', label: 'Plans & Fees' },
        { href: '/admin/subscription-analytics', icon: 'ri-bar-chart-line', label: 'Analytics' },
      ],
    },
    {
      label: 'Support',
      icon: 'ri-customer-service-2-line',
      items: [
        { href: '/admin/support-tickets', icon: 'ri-customer-service-2-line', label: 'Support' },
        {
          href: '/admin/complaints',
          icon: 'ri-feedback-line',
          label: 'Complaints',
          badge: <Badge count={badges.complaints} color="red" />,
        },
      ],
    },
    {
      label: 'Communications',
      icon: 'ri-megaphone-line',
      items: [
        { href: '/admin/announcements', icon: 'ri-megaphone-line', label: 'Announcements' },
        { href: '/admin/email-health', icon: 'ri-mail-check-line', label: 'Email Centre' },
        {
          href: '/admin/contact-submissions',
          icon: 'ri-mail-send-line',
          label: 'Contact Inbox',
          badge: <Badge count={badges.contactSubmissions} color="yellow" />,
        },
      ],
    },
    {
      label: 'Growth',
      icon: 'ri-line-chart-line',
      items: [
        { href: '/admin/leads', icon: 'ri-user-search-line', label: 'Leads' },
        { href: '/admin/promo-tiers', icon: 'ri-price-tag-3-line', label: 'Promotions' },
        { href: '/admin/qg-launch-rewards', icon: 'ri-token-swap-line', label: 'Launch Rewards' },
      ],
    },
    {
      label: 'System',
      icon: 'ri-settings-4-line',
      items: [
        { href: '/admin/system-status', icon: 'ri-heart-pulse-line', label: 'System Health' },
        { href: '/admin/security', icon: 'ri-shield-keyhole-line', label: 'Security' },
        { href: '/admin/stripe-sync', icon: 'ri-bank-card-2-line', label: 'Stripe' },
        { href: '/admin/agents', icon: 'ri-robot-2-line', label: 'Agents' },
        { href: '/admin/wizard-fields', icon: 'ri-layout-masonry-line', label: 'Portal Config' },
        { href: '/admin/settings', icon: 'ri-settings-3-line', label: 'Settings' },
      ],
    },
  ], [badges]);

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const active = groups.find(group => group.items.some(item => isActive(item.href)));
    return active?.label ?? null;
  });

  useEffect(() => {
    const activeGroup = groups.find(group => group.items.some(item => isActive(item.href)));
    if (!activeGroup) return;
    setOpenGroup(activeGroup.label);
  }, [pathname, groups]);

  useEffect(() => {
    async function loadBadges() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('admin-security', {
          body: { action: 'dashboard_stats' },
        });

        if (error) return;

        setBadges({
          failedPayments: data.failedPayments ?? 0,
          guardVerifications: data.guardVerifications ?? 0,
          siaVerifications: data.siaVerifications ?? 0,
          heldPayments: data.heldPayments ?? 0,
          complaints: data.complaints ?? 0,
          contactSubmissions: data.contactSubmissions ?? 0,
        });
      } catch {
        // Sidebar badges are non-critical.
      }
    }

    loadBadges();
    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; };
    }
    return undefined;
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setFlyout(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (collapsed) return;
    setFlyout(null);
  }, [collapsed]);

  const clearFlyoutTimer = () => {
    if (flyoutTimer.current) {
      clearTimeout(flyoutTimer.current);
      flyoutTimer.current = null;
    }
  };

  const openFlyout = (label: string, element: HTMLElement) => {
    clearFlyoutTimer();
    const rect = element.getBoundingClientRect();
    const viewport = typeof window !== 'undefined' ? window.innerHeight : 800;
    const top = Math.max(12, Math.min(rect.top - 8, viewport - 340));
    setFlyout({ label, top });
  };

  const scheduleCloseFlyout = () => {
    clearFlyoutTimer();
    flyoutTimer.current = setTimeout(() => setFlyout(null), 140);
  };

  useEffect(() => () => clearFlyoutTimer(), []);

  const handleLogout = async () => {
    clearAdminAuthCache();
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const toggleGroup = (label: string, isOpen: boolean) => {
    setOpenGroup(isOpen ? null : label);
  };

  const flyoutGroup = flyout ? groups.find(group => group.label === flyout.label) : null;

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <>
      <div className={`flex items-center justify-between ${collapsed ? 'justify-center px-3 py-5' : 'px-5 py-5'}`}>
        {!collapsed && (
          <Link
            href="/admin/dashboard"
            prefetch={false}
            className="text-2xl font-[family-name:var(--font-pacifico)] text-white whitespace-nowrap tracking-tight"
          >
            QuickGuard
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-8 h-8 hidden lg:flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer text-slate-500 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`${collapsed ? 'ri-menu-unfold-4-line' : 'ri-menu-fold-4-line'} text-lg`}></i>
        </button>
      </div>

      <nav data-sidebar-scroll className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-3 space-y-1">
        {groups.map((group) => {
          const groupActive = group.items.some(item => isActive(item.href));
          const isOpen = openGroup === group.label;
          const primary = group.items[0];

          if (collapsed) {
            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={(event) => openFlyout(group.label, event.currentTarget)}
                onMouseLeave={scheduleCloseFlyout}
              >
                <Link
                  href={primary.href}
                  prefetch={false}
                  title={group.label}
                  aria-label={group.label}
                  aria-current={groupActive ? 'page' : undefined}
                  onClick={closeMobile}
                  onFocus={(event) => openFlyout(group.label, event.currentTarget)}
                  onBlur={scheduleCloseFlyout}
                  className={`relative flex items-center justify-center h-11 rounded-xl transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${groupActive
                    ? 'bg-teal-500/12 text-teal-300 ring-1 ring-teal-500/25'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}
                >
                  {groupActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-teal-400" />
                  )}
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${group.icon} text-[17px]`}></i>
                  </div>
                </Link>
              </div>
            );
          }

          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label, isOpen)}
                aria-expanded={isOpen}
                aria-controls={`admin-group-${group.label.toLowerCase()}`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${groupActive
                  ? 'text-teal-300 bg-teal-500/8'
                  : 'text-slate-300 hover:bg-[#1a2b4a] hover:text-white'}`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className={`${group.icon} text-base`}></i>
                </div>
                <span className="flex-1 text-left whitespace-nowrap">{group.label}</span>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`ri-arrow-down-s-line text-sm text-slate-500 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : 'rotate-0'}`}></i>
                </div>
              </button>

              <div
                id={`admin-group-${group.label.toLowerCase()}`}
                aria-hidden={!isOpen}
                className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
              >
                <div className="overflow-hidden min-h-0">
                  <ul className="ml-4 pl-3 border-l border-[#1a2b4a] space-y-0.5">
                    {group.items.map(item => {
                      const itemActive = isActive(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            prefetch={false}
                            aria-current={itemActive ? 'page' : undefined}
                            onClick={closeMobile}
                            className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${itemActive
                              ? 'bg-teal-500/15 text-teal-300 font-semibold shadow-[inset_0_0_0_1px_rgba(45,212,191,0.18)]'
                              : 'text-slate-500 hover:bg-[#1a2b4a] hover:text-slate-200'}`}
                          >
                            <span
                              className={`absolute -left-[13px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full transition-colors ${itemActive ? 'bg-teal-400' : 'bg-transparent'}`}
                            />
                            <div className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${itemActive ? 'text-teal-300' : ''}`}>
                              <i className={`${item.icon} text-sm`}></i>
                            </div>
                            <span className="flex-1">{item.label}</span>
                            {item.badge}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}

        <div className="pt-3 mt-3 border-t border-[#1a2b4a]">
          {!collapsed && (
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-1.5">
              Admin
            </p>
          )}
          <Link
            href="/admin/account"
            prefetch={false}
            title={collapsed ? 'My Account' : undefined}
            aria-label="My Account"
            aria-current={isActive('/admin/account') ? 'page' : undefined}
            onClick={closeMobile}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${isActive('/admin/account')
              ? 'bg-teal-500/12 text-teal-300'
              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'} ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed && isActive('/admin/account') && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-teal-400" />
            )}
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-user-settings-line text-base"></i>
            </div>
            {!collapsed && <span>My Account</span>}
          </Link>
        </div>
      </nav>

      <div className={`border-t border-[#1a2b4a] p-3 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {!collapsed && adminUser.email && (
          <div className="px-3 py-2 mb-2 bg-[#111d35] rounded-xl">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-teal-400 text-sm"></i>
              </div>
              <p className="text-sm font-semibold text-white truncate">{adminUser.name || 'Admin'}</p>
              {adminUser.role && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${adminUser.role === 'super_admin'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : adminUser.role === 'finance_admin'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-[#1a2b4a] text-slate-400 border border-[#1a2b4a]'}`}
                >
                  {adminUser.role === 'super_admin' ? 'Super Admin' : adminUser.role === 'finance_admin' ? 'Finance Admin' : 'Admin'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate pl-9">{adminUser.email}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${collapsed ? 'justify-center w-11' : 'w-full'}`}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-logout-box-r-line text-base"></i>
          </div>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[70] w-10 h-10 flex items-center justify-center rounded-xl bg-[#111d35] shadow-lg border border-[#1a2b4a] text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        <i className={`${mobileOpen ? 'ri-close-line' : 'ri-menu-3-line'} text-xl`}></i>
      </button>

      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <aside
        className={`flex flex-col bg-[#0B1933] transition-[width,transform] duration-300 ease-out min-h-screen sticky top-0 border-r border-[#1a2b4a] shadow-sm lg:translate-x-0 ${collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64'} w-64 fixed lg:relative z-50 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ flexShrink: 0 }}
        aria-label="Admin navigation"
      >
        {sidebarContent}
      </aside>

      {collapsed && flyoutGroup && flyout && (
        <div
          className="hidden lg:block fixed z-[80] animate-[flyoutIn_160ms_ease-out]"
          style={{ left: COLLAPSED_WIDTH + 8, top: flyout.top }}
          onMouseEnter={clearFlyoutTimer}
          onMouseLeave={scheduleCloseFlyout}
        >
          <div className="min-w-[13rem] bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-2xl shadow-black/50 p-2">
            <div className="flex items-center gap-2 px-2.5 py-2 mb-1">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${flyoutGroup.icon} text-sm text-teal-400`}></i>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {flyoutGroup.label}
              </p>
            </div>
            <ul className="space-y-0.5">
              {flyoutGroup.items.map(item => {
                const itemActive = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={closeMobile}
                      aria-current={itemActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${itemActive
                        ? 'bg-teal-500/15 text-teal-300 font-semibold'
                        : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}
                    >
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <i className={`${item.icon} text-sm`}></i>
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {item.badge}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        [data-sidebar-scroll] {
          scrollbar-width: thin;
          scrollbar-color: #2a3d5c transparent;
        }
        [data-sidebar-scroll]::-webkit-scrollbar {
          width: 5px;
        }
        [data-sidebar-scroll]::-webkit-scrollbar-track {
          background: transparent;
        }
        [data-sidebar-scroll]::-webkit-scrollbar-thumb {
          background: #2a3d5c;
          border-radius: 10px;
        }
        [data-sidebar-scroll]::-webkit-scrollbar-thumb:hover {
          background: #3d5577;
        }
        @keyframes flyoutIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-sidebar-scroll] * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </>
  );
}