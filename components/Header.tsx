'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getMaintenanceMode } from '@/lib/maintenance';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';

type UserRole = 'guard' | 'client' | null;

interface LoggedInUser {
  email: string;
  name: string;
  role: UserRole;
  initials: string;
  guardName: string;
  clientName: string;
  hasBothRoles: boolean;
}

const ROLE_PREF_KEY = 'quickguard_active_role';

function getStoredRole(): UserRole {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(ROLE_PREF_KEY);
  if (stored === 'guard' || stored === 'client') return stored;
  return null;
}

function setStoredRole(role: UserRole) {
  if (typeof window === 'undefined') return;
  if (role) localStorage.setItem(ROLE_PREF_KEY, role);
  else localStorage.removeItem(ROLE_PREF_KEY);
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showGuardDropdown, setShowGuardDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const megaMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useSafeRouter();

  useEffect(() => {
    const isAdminPath = pathname?.startsWith('/admin');
    if (isAdminPath) { setIsMaintenanceMode(false); return; }
    let cancelled = false;
    getMaintenanceMode().then((mode) => {
      if (!cancelled) setIsMaintenanceMode(mode);
    });
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { setLoggedInUser(null); return; }

      let role: UserRole = null;
      let name = user.email ?? '';

      const metaUserType = (user.user_metadata?.user_type) || (user.app_metadata?.user_type);

      const { data: guardData } = await supabase
        .from('guards')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, contact_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasGuard = !!guardData;
      const hasClient = !!clientData;
      const guardName = guardData?.full_name || '';
      const clientName = clientData?.contact_name || clientData?.company_name || '';

      if (!hasGuard && !hasClient) { if (mounted) setLoggedInUser(null); return; }

      if (hasGuard && hasClient) {
        const stored = getStoredRole();
        if (stored && ((stored === 'guard' && hasGuard) || (stored === 'client' && hasClient))) {
          role = stored;
        } else if (metaUserType === 'guard' || metaUserType === 'client') {
          role = metaUserType;
        } else {
          role = 'client';
        }
        name = role === 'guard' ? (guardName || user.email!) : (clientName || user.email!);
      } else if (hasGuard) {
        role = 'guard';
        name = guardName || user.email!;
      } else if (hasClient) {
        role = 'client';
        name = clientName || user.email!;
      }

      if (role) {
        const parts = name.trim().split(' ');
        const initials = parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase();

        if (mounted) {
          setLoggedInUser({
            email: user.email!,
            name,
            role,
            initials,
            guardName,
            clientName,
            hasBothRoles: hasGuard && hasClient,
          });
        }
      } else {
        if (mounted) setLoggedInUser(null);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (mounted) fetchUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loggedInUser) { setUnreadCount(0); return; }
    let mounted = true;

    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (mounted) setUnreadCount(count ?? 0);
    };

    fetchUnread();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) return;
      channel = supabase
        .channel('notifications-header')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => { if (mounted) fetchUnread(); })
        .subscribe();
    });

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loggedInUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        setShowGuardDropdown(false);
        setShowClientDropdown(false);
        setShowMegaMenu(false);
        setShowProfileDropdown(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleMegaMenuEnter = () => {
    if (megaMenuTimeoutRef.current) clearTimeout(megaMenuTimeoutRef.current);
    setShowMegaMenu(true);
  };

  const handleMegaMenuLeave = () => {
    megaMenuTimeoutRef.current = setTimeout(() => setShowMegaMenu(false), 200);
  };

  const handleMegaMenuLinkClick = () => setShowMegaMenu(false);

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isMaintenanceMode) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLoggedInUser(null);
    setShowProfileDropdown(false);
    setStoredRole(null);
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    router.push('/');
  };

  const handleSwitchRole = () => {
    if (!loggedInUser) return;
    const newRole: UserRole = loggedInUser.role === 'guard' ? 'client' : 'guard';
    const newName = newRole === 'guard' ? loggedInUser.guardName : loggedInUser.clientName;
    const displayName = newName || loggedInUser.email;
    const parts = displayName.trim().split(' ');
    const newInitials = parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

    setStoredRole(newRole);
    setLoggedInUser({
      ...loggedInUser,
      role: newRole,
      name: displayName,
      initials: newInitials,
    });
    setShowProfileDropdown(false);

    if (newRole === 'guard') router.push('/guard/dashboard');
    else router.push('/client/dashboard');
  };

  const getDashboardLink = () =>
    loggedInUser?.role === 'guard' ? '/guard/dashboard' : '/client/dashboard';

  const getProfileLink = () =>
    loggedInUser?.role === 'guard' ? '/guard/profile' : '/client/profile';

  const getNotificationsLink = () =>
    loggedInUser?.role === 'guard' ? '/guard/dashboard' : '/client/dashboard';

  const getRoleColor = () =>
    loggedInUser?.role === 'guard' ? 'bg-emerald-600' : 'bg-blue-600';

  const getRoleBadge = () =>
    loggedInUser?.role === 'guard' ? 'Guard' : 'Client';

  const getPostJobHref = () => {
    if (!loggedInUser) return '/client/register?redirect=/post-job';
    if (loggedInUser.role === 'client') return '/client/post-job';
    if (loggedInUser.hasBothRoles) return '/client/post-job';
    return '/client/register?redirect=/post-job';
  };

  const handleHireGuardClick = (e: React.MouseEvent) => {
    if (loggedInUser?.role === 'guard' && !loggedInUser.hasBothRoles) {
      e.preventDefault();
      setShowRoleSwitchModal(true);
      return;
    }
    if (loggedInUser?.role === 'guard' && loggedInUser.hasBothRoles) {
      e.preventDefault();
      handleSwitchRole();
      return;
    }
    if (!loggedInUser) {
      e.preventDefault();
      router.push('/client/register?redirect=/post-job');
      return;
    }
  };

  const isActive = (href: string) => pathname === href;

  const navLinkClass = (href: string) =>
    `relative font-medium transition-colors focus:outline-none rounded px-2 py-1 ${
      isActive(href)
        ? 'text-blue-600 after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-blue-600 after:rounded-full'
        : 'text-gray-700 hover:text-blue-600'
    }`;

  const mobileNavLinkClass = (href: string) =>
    `block px-4 py-3 transition-colors focus:outline-none ${
      isActive(href)
        ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600'
        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'
    }`;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/jobs?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setShowSearchBar(false);
      setIsMenuOpen(false);
    }
  };

  const handleCategoryClick = (category: string) => {
    router.push(`/jobs?search=${encodeURIComponent(category)}`);
    setShowSearchBar(false);
    setSearchQuery('');
    setIsMenuOpen(false);
  };

  const jobCategories = [
    { label: 'Event Security', icon: 'ri-calendar-event-line' },
    { label: 'Door Supervisor', icon: 'ri-door-open-line' },
    { label: 'Retail Security', icon: 'ri-store-2-line' },
    { label: 'Corporate', icon: 'ri-building-2-line' },
    { label: 'Construction', icon: 'ri-hammer-line' },
    { label: 'Night Patrol', icon: 'ri-moon-line' },
  ];

  const venuePages = [
    { label: 'Nightclubs', href: '/security-for-nightclubs' },
    { label: 'Shops', href: '/security-for-shops' },
    { label: 'Building Sites', href: '/security-for-building-sites' },
    { label: 'Events', href: '/security-for-events' },
  ];

  const handleSearchIconClick = () => {
    setShowSearchBar(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40">
        <nav className="w-full px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex items-center justify-between h-20">
            <Link href="/" prefetch={false} onClick={handleLinkClick} className="flex items-center space-x-2 focus:outline-none rounded-lg">
              <img
                src="https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp"
                alt="QuickGuard"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-pacifico)]">QuickGuard</span>
            </Link>

            <ul className="hidden lg:flex items-center space-x-8 list-none m-0 p-0">
              <li>
                <Link href={getPostJobHref()} prefetch={false} onClick={handleHireGuardClick} className={navLinkClass('/post-job')}>
                  Hire a Guard
                </Link>
              </li>
              <li>
                <Link href="/find-a-guard" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/find-a-guard')}>
                  Find Guards
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/how-it-works')}>
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/jobs" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/jobs')}>
                  Find Jobs
                </Link>
              </li>
              <li>
                <Link href="/pricing" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/pricing')}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/contact')}>
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/help" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/help')}>
                  Help
                </Link>
              </li>
              <li>
                <Link href="/qg-launch-rewards" prefetch={false} onClick={handleLinkClick} className={navLinkClass('/qg-launch-rewards')}>
                  Launch Rewards
                </Link>
              </li>

              {!loggedInUser && (
                <>
                  <li className="relative">
                    <button
                      onClick={() => setShowGuardDropdown(!showGuardDropdown)}
                      onKeyDown={(e) => handleKeyDown(e, () => setShowGuardDropdown(!showGuardDropdown))}
                      className={`flex items-center space-x-1 font-medium transition-colors focus:outline-none rounded px-2 py-1 ${
                        ['/guard/register', '/guard/login', '/guide/guard'].includes(pathname ?? '')
                          ? 'text-blue-600'
                          : 'text-gray-700 hover:text-blue-600'
                      }`}
                      aria-expanded={showGuardDropdown}
                      aria-haspopup="true"
                      aria-controls="guard-dropdown-menu"
                    >
                      <span>For Guards</span>
                      <i className={`ri-arrow-down-s-line transition-transform ${showGuardDropdown ? 'rotate-180' : ''}`} aria-hidden="true"></i>
                    </button>
                    {showGuardDropdown && (
                      <ul id="guard-dropdown-menu" className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 border border-gray-100 list-none m-0 p-0" role="menu" aria-label="Guard options">
                        <li role="none">
                          <Link href="/guard/register" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/guard/register') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Register as Guard</Link>
                        </li>
                        <li role="none">
                          <Link href="/guard/login" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/guard/login') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Guard Login</Link>
                        </li>
                        <li role="none">
                          <Link href="/guide/guard" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/guide/guard') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Guard Guide</Link>
                        </li>
                      </ul>
                    )}
                  </li>

                  <li className="relative">
                    <button
                      onClick={() => setShowClientDropdown(!showClientDropdown)}
                      onKeyDown={(e) => handleKeyDown(e, () => setShowClientDropdown(!showClientDropdown))}
                      className={`flex items-center space-x-1 font-medium transition-colors focus:outline-none rounded px-2 py-1 ${
                        ['/client/register', '/client/login', '/guide/client'].includes(pathname ?? '')
                          ? 'text-blue-600'
                          : 'text-gray-700 hover:text-blue-600'
                      }`}
                      aria-expanded={showClientDropdown}
                      aria-haspopup="true"
                      aria-controls="client-dropdown-menu"
                    >
                      <span>For Clients</span>
                      <i className={`ri-arrow-down-s-line transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} aria-hidden="true"></i>
                    </button>
                    {showClientDropdown && (
                      <ul id="client-dropdown-menu" className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 border border-gray-100 list-none m-0 p-0" role="menu" aria-label="Client options">
                        <li role="none">
                          <Link href="/client/register" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/client/register') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Register as Client</Link>
                        </li>
                        <li role="none">
                          <Link href="/client/login" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/client/login') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Client Login</Link>
                        </li>
                        <li role="none">
                          <Link href="/guide/client" prefetch={false} onClick={handleLinkClick} className={`block px-4 py-2 transition-colors focus:outline-none ${isActive('/guide/client') ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600'}`} role="menuitem">Client Guide</Link>
                        </li>
                      </ul>
                    )}
                  </li>
                </>
              )}

              {loggedInUser && (
                <>
                  <li>
                    <Link
                      href={getNotificationsLink()}
                      prefetch={false}
                      onClick={handleLinkClick}
                      className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
                      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    >
                      <i className="ri-notification-3-line text-gray-600 text-xl"></i>
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>

                  <li className="relative" ref={profileDropdownRef}>
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="flex items-center space-x-2 focus:outline-none rounded-full cursor-pointer"
                      aria-expanded={showProfileDropdown}
                      aria-haspopup="true"
                    >
                      <div className={`w-9 h-9 rounded-full ${getRoleColor()} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                        {loggedInUser.initials}
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">{loggedInUser.name}</span>
                        <span className={`text-xs font-medium ${loggedInUser.role === 'guard' ? 'text-emerald-600' : 'text-blue-600'}`}>{getRoleBadge()}</span>
                      </div>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className={`ri-arrow-down-s-line text-gray-500 transition-transform text-base ${showProfileDropdown ? 'rotate-180' : ''}`}></i>
                      </div>
                    </button>

                    {showProfileDropdown && (
                      <div className="absolute top-full right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        <div className={`px-4 py-3 ${loggedInUser.role === 'guard' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full ${getRoleColor()} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                              {loggedInUser.initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{loggedInUser.name}</p>
                              <p className="text-xs text-gray-500 truncate">{loggedInUser.email}</p>
                            </div>
                          </div>
                          <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${loggedInUser.role === 'guard' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {getRoleBadge()} Account
                          </span>
                        </div>

                        <div className="py-1">
                          <Link
                            href={getDashboardLink()}
                            prefetch={false}
                            onClick={() => setShowProfileDropdown(false)}
                            className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className="ri-dashboard-line text-gray-400 text-base"></i>
                            </div>
                            <span className="text-sm font-medium">Dashboard</span>
                          </Link>
                          <Link
                            href={getProfileLink()}
                            prefetch={false}
                            onClick={() => setShowProfileDropdown(false)}
                            className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className="ri-user-line text-gray-400 text-base"></i>
                            </div>
                            <span className="text-sm font-medium">My Profile</span>
                          </Link>
                          {loggedInUser.role === 'guard' && (
                            <Link
                              href="/guard/earnings"
                              prefetch={false}
                              onClick={() => setShowProfileDropdown(false)}
                              className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <div className="w-5 h-5 flex items-center justify-center">
                                <i className="ri-money-pound-circle-line text-gray-400 text-base"></i>
                              </div>
                              <span className="text-sm font-medium">Earnings</span>
                            </Link>
                          )}
                          {loggedInUser.role === 'client' && (
                            <Link
                              href="/client/jobs"
                              prefetch={false}
                              onClick={() => setShowProfileDropdown(false)}
                              className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <div className="w-5 h-5 flex items-center justify-center">
                                <i className="ri-briefcase-line text-gray-400 text-base"></i>
                              </div>
                              <span className="text-sm font-medium">My Jobs</span>
                            </Link>
                          )}
                        </div>

                        <div className="border-t border-gray-100 py-1">
                          {loggedInUser.hasBothRoles && (
                            <button
                              onClick={handleSwitchRole}
                              className="w-full flex items-center space-x-3 px-4 py-2.5 text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <div className="w-5 h-5 flex items-center justify-center">
                                <i className="ri-exchange-line text-amber-500 text-base"></i>
                              </div>
                              <span className="text-sm font-medium">Switch to {loggedInUser.role === 'guard' ? 'Client' : 'Guard'}</span>
                            </button>
                          )}
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className="ri-logout-box-r-line text-red-500 text-base"></i>
                            </div>
                            <span className="text-sm font-medium">Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                </>
              )}

              <li className="flex items-center">
                {showSearchBar ? (
                  <div className="relative">
                    <form onSubmit={handleSearchSubmit} className="flex items-center">
                      <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <div className="w-8 h-8 flex items-center justify-center pl-2">
                          <i className="ri-search-line text-gray-400 text-base"></i>
                        </div>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search jobs..."
                          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none px-2 py-2 w-44"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setShowSearchBar(false);
                              setSearchQuery('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}
                          className="w-7 h-7 flex items-center justify-center mr-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                          aria-label="Close search"
                        >
                          <i className="ri-close-line text-base"></i>
                        </button>
                      </div>
                    </form>
                    <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-72 z-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Popular Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {jobCategories.map((cat) => (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => handleCategoryClick(cat.label)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <div className="w-3.5 h-3.5 flex items-center justify-center">
                              <i className={`${cat.icon} text-xs`}></i>
                            </div>
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSearchIconClick}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none cursor-pointer"
                    aria-label="Search jobs"
                  >
                    <i className="ri-search-line text-xl"></i>
                  </button>
                )}
              </li>
            </ul>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-gray-700 hover:text-blue-600 focus:outline-none rounded"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {loggedInUser && unreadCount > 0 && !isMenuOpen && (
                <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
              <i className={`text-2xl ${isMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`} aria-hidden="true"></i>
            </button>
          </div>

          {isMenuOpen && (
            <nav id="mobile-menu" className="lg:hidden py-4 border-t border-gray-100" aria-label="Mobile navigation">
              <div className="px-4 mb-3">
                <form onSubmit={handleSearchSubmit} className="flex items-center bg-gray-100 rounded-lg border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden">
                  <div className="w-9 h-9 flex items-center justify-center pl-2">
                    <i className="ri-search-line text-gray-400 text-base"></i>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs by keyword..."
                    className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none px-2 py-2.5"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-blue-600 font-semibold text-sm hover:text-blue-700 cursor-pointer whitespace-nowrap"
                  >
                    Search
                  </button>
                </form>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Popular Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {jobCategories.map((cat) => (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => handleCategoryClick(cat.label)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                          <i className={`${cat.icon} text-xs`}></i>
                        </div>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <ul className="list-none m-0 p-0">
                <li>
                  <Link href={getPostJobHref()} prefetch={false} onClick={(e) => { handleHireGuardClick(e); setIsMenuOpen(false); }} className={mobileNavLinkClass('/post-job')}>Hire a Guard</Link>
                </li>
                <li>
                  <Link href="/find-a-guard" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/find-a-guard')}>Find Guards</Link>
                </li>
                <li>
                  <Link href="/how-it-works" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/how-it-works')}>How It Works</Link>
                </li>
                <li>
                  <Link href="/jobs" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/jobs')}>Find Jobs</Link>
                </li>
                <li>
                  <Link href="/pricing" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/pricing')}>Pricing</Link>
                </li>
                <li>
                  <Link href="/contact" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/contact')}>Contact</Link>
                </li>
                <li>
                  <Link href="/help" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/help')}>Help</Link>
                </li>
                <li>
                  <Link href="/qg-launch-rewards" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/qg-launch-rewards')}>Launch Rewards</Link>
                </li>
              </ul>

              {loggedInUser ? (
                <>
                  <div className="border-t border-gray-100 my-2"></div>
                  <div className={`mx-4 my-2 p-3 rounded-xl ${loggedInUser.role === 'guard' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full ${getRoleColor()} flex items-center justify-center text-white font-bold text-sm`}>
                        {loggedInUser.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{loggedInUser.name}</p>
                        <p className={`text-xs font-medium ${loggedInUser.role === 'guard' ? 'text-emerald-600' : 'text-blue-600'}`}>{getRoleBadge()} Account</p>
                      </div>
                    </div>
                  </div>
                  <ul className="list-none m-0 p-0">
                    <li>
                      <Link href={getDashboardLink()} prefetch={false} onClick={() => setIsMenuOpen(false)} className={`flex items-center space-x-3 px-4 py-3 transition-colors ${isActive(getDashboardLink()) ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}>
                        <div className="w-5 h-5 flex items-center justify-center"><i className="ri-dashboard-line text-base"></i></div>
                        <span>Dashboard</span>
                      </Link>
                    </li>
                    <li>
                      <Link href={getProfileLink()} prefetch={false} onClick={() => setIsMenuOpen(false)} className={`flex items-center space-x-3 px-4 py-3 transition-colors ${isActive(getProfileLink()) ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}>
                        <div className="w-5 h-5 flex items-center justify-center"><i className="ri-user-line text-base"></i></div>
                        <span>My Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={getNotificationsLink()}
                        prefetch={false}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center justify-between px-4 py-3 transition-colors ${isActive(getNotificationsLink()) ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 flex items-center justify-center"><i className="ri-notification-3-line text-base"></i></div>
                          <span>Notifications</span>
                        </div>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    </li>
                    <li>
                      <button onClick={handleSignOut} className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                        <div className="w-5 h-5 flex items-center justify-center"><i className="ri-logout-box-r-line text-base"></i></div>
                        <span>Sign Out</span>
                      </button>
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <div className="border-t border-gray-100 my-2" role="separator"></div>
                  <p className="px-4 py-2 text-sm font-semibold text-gray-500">For Guards</p>
                  <ul className="list-none m-0 p-0">
                    <li>
                      <Link href="/guard/register" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/guard/register')}>Register as Guard</Link>
                    </li>
                    <li>
                      <Link href="/guard/login" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/guard/login')}>Guard Login</Link>
                    </li>
                  </ul>
                  <div className="border-t border-gray-100 my-2" role="separator"></div>
                  <p className="px-4 py-2 text-sm font-semibold text-gray-500">For Clients</p>
                  <ul className="list-none m-0 p-0">
                    <li>
                      <Link href="/client/register" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/client/register')}>Register as Client</Link>
                    </li>
                    <li>
                      <Link href="/client/login" prefetch={false} onClick={handleLinkClick} className={mobileNavLinkClass('/client/login')}>Client Login</Link>
                    </li>
                  </ul>
                </>
              )}

              <div className="border-t border-gray-100 my-2" role="separator"></div>
            </nav>
          )}
        </nav>
      </header>

      <div className="h-20"></div>

      {showRoleSwitchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowRoleSwitchModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                <i className="ri-exchange-line text-xl text-amber-500"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Switch to Client Account</h3>
            </div>
            <p className="text-gray-600 text-sm mb-5">
              You are currently logged in as a <strong>Guard</strong>. To hire a guard, you need a client account.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowRoleSwitchModal(false); router.push('/client/register?redirect=/post-job'); }}
                className="w-full bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                Create Client Account
              </button>
              <button
                onClick={() => { setShowRoleSwitchModal(false); router.push('/guard/dashboard'); }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                Back to Guard Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}