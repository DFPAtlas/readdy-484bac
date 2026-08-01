'use client';

import { useState, useEffect } from 'react';
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

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useSafeRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [badges, setBadges] = useState<BadgeCounts>({
    failedPayments: 0,
    guardVerifications: 0,
    siaVerifications: 0,
    heldPayments: 0,
    complaints: 0,
    contactSubmissions: 0,
  });

  const adminUser = useAdminAuth();

  useEffect(() => {
    async function loadBadges() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
        });

        const { data, error } = await supabase.functions.invoke('admin-security', {
          body: { action: 'dashboard_stats' },
        });

        if (error) {
          return;
        }

        setBadges({
          failedPayments: data.failedPayments ?? 0,
          guardVerifications: data.guardVerifications ?? 0,
          siaVerifications: data.siaVerifications ?? 0,
          heldPayments: data.heldPayments ?? 0,
          complaints: data.complaints ?? 0,
          contactSubmissions: data.contactSubmissions ?? 0,
        });
      } catch (err) {
        // silently fail
      }
    }

    loadBadges();

    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    clearAdminAuthCache();
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const isActive = (href: string) => pathname === href;

  const Badge = ({ count, color = 'red' }: { count: number; color?: 'red' | 'yellow' }) => {
    if (count === 0) return null;
    const cls = color === 'red'
      ? 'bg-red-500 text-white'
      : 'bg-amber-400 text-slate-900';
    return (
      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full leading-none ${cls}`}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const mainGroups = [
    {
      label: 'Overview',
      items: [
        { href: '/admin/dashboard', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
        { href: '/admin/live-test-checklist', icon: 'ri-check-double-line', label: 'Launch Checklist' },
        { href: '/admin/security', icon: 'ri-shield-keyhole-line', label: 'Security' },
        { href: '/admin/system-status', icon: 'ri-heart-pulse-line', label: 'System Status' },
        { href: '/admin/activity-log', icon: 'ri-history-line', label: 'Activity Log' },
      ],
    },
    {
      label: 'Users',
      items: [
        { href: '/admin/user-provisioning', icon: 'ri-user-settings-line', label: 'User Provisioning' },
        { href: '/company/dashboard', icon: 'ri-building-2-line', label: 'Company Portal' },
        { href: '/admin/accounts', icon: 'ri-team-line', label: 'Client & Guard Mgmt' },
        { href: '/admin/client-monitoring', icon: 'ri-dashboard-line', label: 'Client Monitoring' },
        { href: '/admin/client-profiles', icon: 'ri-building-4-line', label: 'Client Profiles' },
        { href: '/admin/guard-profiles', icon: 'ri-shield-user-line', label: 'Guard Profiles' },
        { href: '/admin/guard-verifications', icon: 'ri-shield-check-line', label: 'Guard Verifications', badge: <Badge count={badges.guardVerifications} color="yellow" /> },
        { href: '/admin/add-guard', icon: 'ri-user-add-line', label: 'Add Guard' },
        { href: '/admin/sia-verifications', icon: 'ri-id-card-line', label: 'SIA Verifications', badge: <Badge count={badges.siaVerifications} color="yellow" /> },
        { href: '/admin/reviews', icon: 'ri-star-line', label: 'Guard Reviews' },
        { href: '/admin/qg-launch-rewards', icon: 'ri-token-swap-line', label: 'QG Launch Rewards' },
      ],
    },
    {
      label: 'Jobs',
      items: [
        { href: '/admin/jobs', icon: 'ri-briefcase-line', label: 'All Jobs' },
      ],
    },
    {
      label: 'Payments',
      items: [
        { href: '/admin/payments-jobs', icon: 'ri-money-pound-circle-line', label: 'Payments & Jobs' },
        { href: '/admin/payments', icon: 'ri-secure-payment-line', label: 'All Payments' },
        { href: '/admin/payment-management', icon: 'ri-bank-card-line', label: 'Payment Settings' },
        { href: '/admin/platform-finances', icon: 'ri-pie-chart-line', label: 'Platform Finances' },
        { href: '/admin/failed-payments', icon: 'ri-error-warning-line', label: 'Failed Payments', badge: <Badge count={badges.failedPayments} color="red" /> },
        { href: '/admin/held-payments', icon: 'ri-lock-2-line', label: 'Held Payments', badge: <Badge count={badges.heldPayments} color="yellow" /> },
      ],
    },
  ];

  const moreGroups = [
    {
      label: 'Portals',
      items: [
        { href: '/admin/wizard-fields', icon: 'ri-layout-masonry-line', label: 'Portal Editor' },
        { href: '/client/dashboard', icon: 'ri-building-2-line', label: 'Client Portal' },
        { href: '/guard/dashboard', icon: 'ri-shield-user-line', label: 'Guard Portal' },
      ],
    },
    {
      label: 'Subscriptions',
      items: [
        { href: '/admin/plan-fee-rules', icon: 'ri-settings-3-line', label: 'Plan & Fee Rules' },
        { href: '/admin/plan-change-history', icon: 'ri-history-line', label: 'Plan Change History' },
        { href: '/admin/subscription-analytics', icon: 'ri-bar-chart-line', label: 'Analytics' },
        { href: '/admin/subscription-tracking', icon: 'ri-radar-line', label: 'Tracking' },
        { href: '/admin/revenue-forecast', icon: 'ri-line-chart-line', label: 'Revenue Forecast' },
        { href: '/admin/subscription-management', icon: 'ri-bank-card-line', label: 'Subscription Mgmt' },
      ],
    },
    {
      label: 'Content',
      items: [
        { href: '/admin/announcements', icon: 'ri-megaphone-line', label: 'Announcements' },
        { href: '/admin/email-templates', icon: 'ri-mail-settings-line', label: 'Email Templates' },
        { href: '/admin/email-health', icon: 'ri-mail-check-line', label: 'Email Health' },
        { href: '/admin/social-media-content', icon: 'ri-share-line', label: 'Social Media' },
        { href: '/admin/accessibility-feedback', icon: 'ri-wheelchair-line', label: 'Accessibility' },
        { href: '/admin/contact-submissions', icon: 'ri-mail-send-line', label: 'Contact Submissions', badge: <Badge count={badges.contactSubmissions} color="yellow" /> },
        { href: '/admin/lead-finder', icon: 'ri-radar-line', label: 'Lead Finder' },
        { href: '/admin/leads', icon: 'ri-user-search-line', label: 'Leads' },
        { href: '/admin/complaints', icon: 'ri-feedback-line', label: 'Complaints', badge: <Badge count={badges.complaints} color="red" /> },
      ],
    },
  ];

  const moreBadgeCount = badges.contactSubmissions + badges.complaints;

  const sidebarContent = (
    <>
      <div className={`flex items-center justify-between px-5 py-5 ${collapsed ? 'justify-center px-3 py-4' : ''}`}>
        {!collapsed && (
          <Link href="/admin/dashboard" prefetch={false} className="text-2xl font-[family-name:var(--font-pacifico)] text-white whitespace-nowrap tracking-tight">
            QuickGuard
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] transition cursor-pointer text-slate-500 hover:text-white"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`${collapsed ? 'ri-menu-unfold-4-line' : 'ri-menu-fold-4-line'} text-lg`}></i>
        </button>
      </div>

      <nav data-sidebar-scroll className="flex-1 overflow-y-auto py-2 px-3 space-y-5">
        {mainGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap outline-none ${
                      isActive(item.href)
                        ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                        : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                      <i className={`${item.icon} text-base ${isActive(item.href) ? 'text-teal-400' : ''}`}></i>
                      {collapsed && 'badge' in item && item.badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0B1933]"></span>
                      )}
                    </div>
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && 'badge' in item && item.badge}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* More toggle */}
        <div>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap w-full ${
              moreOpen
                ? 'text-teal-400 bg-teal-500/5'
                : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
              <i className="ri-more-2-line text-base"></i>
              {collapsed && moreBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0B1933]"></span>
              )}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1">More</span>
                {moreBadgeCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full leading-none bg-amber-400 text-slate-900">
                    {moreBadgeCount > 99 ? '99+' : moreBadgeCount}
                  </span>
                )}
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className={`${moreOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-sm text-slate-500`}></i>
                </div>
              </>
            )}
          </button>
          {moreOpen && (
            <div className="mt-2 space-y-5">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  {!collapsed && (
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1.5">
                      {group.label}
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          title={collapsed ? item.label : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap outline-none ${
                            isActive(item.href)
                              ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                          } ${collapsed ? 'justify-center' : ''}`}
                        >
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                            <i className={`${item.icon} text-base ${isActive(item.href) ? 'text-teal-400' : ''}`}></i>
                            {collapsed && 'badge' in item && item.badge && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0B1933]"></span>
                            )}
                          </div>
                          {!collapsed && <span className="flex-1">{item.label}</span>}
                          {!collapsed && 'badge' in item && item.badge}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin & Settings */}
        <div>
          {!collapsed && (
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1.5">
              Admin
            </p>
          )}
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/admin/account"
                prefetch={false}
                title={collapsed ? 'My Account' : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap outline-none ${
                  isActive('/admin/account')
                    ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className={`ri-user-settings-line text-base ${isActive('/admin/account') ? 'text-teal-400' : ''}`}></i>
                </div>
                {!collapsed && <span>My Account</span>}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/settings"
                prefetch={false}
                title={collapsed ? 'Site Settings' : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap outline-none ${
                  isActive('/admin/settings')
                    ? 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className={`ri-settings-3-line text-base ${isActive('/admin/settings') ? 'text-teal-400' : ''}`}></i>
                </div>
                {!collapsed && <span>Site Settings</span>}
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className={`border-t border-[#1a2b4a] p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && adminUser.email && (
          <div className="px-3 py-2 mb-2 bg-[#111d35] rounded-xl">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-teal-400 text-sm"></i>
              </div>
              <p className="text-sm font-semibold text-white truncate">{adminUser.name || 'Admin'}</p>
              {adminUser.role && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                  adminUser.role === 'super_admin'
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : adminUser.role === 'finance_admin'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-[#1a2b4a] text-slate-400 border border-[#1a2b4a]'
                }`}>
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
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full whitespace-nowrap ${collapsed ? 'justify-center' : ''}`}
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
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-[#111d35] shadow-lg border border-[#1a2b4a] text-white cursor-pointer"
        aria-label="Toggle menu"
      >
        <i className={`${mobileOpen ? 'ri-close-line' : 'ri-menu-3-line'} text-xl`}></i>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-[#0B1933] transition-all duration-300 min-h-screen sticky top-0 border-r border-[#1a2b4a] shadow-sm ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50`}
        style={{ flexShrink: 0 }}
      >
        {sidebarContent}
      </aside>
      {/* Scrollbar styles */}
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
      `}</style>
    </>
  );
}