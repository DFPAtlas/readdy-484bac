'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import LoginModal from './LoginModal';

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

export default function NavSidebar() {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUserType, setLoginUserType] = useState<'guard' | 'client'>('guard');
  const pathname = usePathname();
  const router = useSafeRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resolveActiveRole = (hasGuard: boolean, hasClient: boolean, metaUserType: string | undefined): UserRole => {
    if (hasGuard && hasClient) {
      const stored = getStoredRole();
      if (stored && ((stored === 'guard' && hasGuard) || (stored === 'client' && hasClient))) return stored;
      if (metaUserType === 'guard' || metaUserType === 'client') return metaUserType;
      return 'client';
    }
    if (hasGuard) return 'guard';
    if (hasClient) return 'client';
    return null;
  };

  const resolveName = (role: UserRole, guardName: string, clientName: string, email: string): string => {
    if (role === 'guard') return guardName || email;
    if (role === 'client') return clientName || email;
    return email;
  };

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { setLoggedInUser(null); return; }

      const metaUserType = (user.user_metadata?.user_type) || (user.app_metadata?.user_type);

      const { data: guardData } = await supabase
        .from('guards').select('full_name').eq('user_id', user.id).maybeSingle();

      const { data: clientData } = await supabase
        .from('clients').select('company_name, contact_name').eq('user_id', user.id).maybeSingle();

      const hasGuard = !!guardData;
      const hasClient = !!clientData;
      const guardName = guardData?.full_name || '';
      const clientName = clientData?.contact_name || clientData?.company_name || '';

      if (!hasGuard && !hasClient) { if (mounted) setLoggedInUser(null); return; }

      const role = resolveActiveRole(hasGuard, hasClient, metaUserType);
      const name = resolveName(role, guardName, clientName, user.email!);

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
      const { count } = await supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false);
      if (mounted) setUnreadCount(count ?? 0);
    };
    fetchUnread();
    return () => { mounted = false; };
  }, [loggedInUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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

    if (newRole === 'guard') router.push('/guard/dashboard');
    else router.push('/client/dashboard');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLoggedInUser(null);
    setSidebarOpen(false);
    setStoredRole(null);
    router.push('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/jobs?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setSidebarOpen(false);
    }
  };

  const getDashboardLink = () => loggedInUser?.role === 'guard' ? '/guard/dashboard' : '/client/dashboard';
  const getProfileLink = () => loggedInUser?.role === 'guard' ? '/guard/profile' : '/client/profile';
  const getRoleColor = () => loggedInUser?.role === 'guard' ? 'bg-emerald-600' : 'bg-blue-600';
  const getRoleBadge = () => loggedInUser?.role === 'guard' ? 'Guard' : 'Client';

  const linkClass = (href: string) => {
    const isActive = pathname === href;
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm font-medium outline-none ${
      isActive ? 'bg-teal-500 text-slate-900' : 'hover:bg-slate-700 text-slate-300 hover:text-white'
    }`;
  };

  const iconClass = (href: string) => {
    const isActive = pathname === href;
    return `w-5 h-5 flex items-center justify-center flex-shrink-0 ${isActive ? 'text-slate-900' : 'text-teal-400'}`;
  };

  return (
    <>
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 bg-teal-500 text-slate-900 p-3 rounded-lg shadow-lg hover:bg-teal-400 transition cursor-pointer"
        aria-label="Open navigation menu"
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          <i className="ri-menu-line text-xl"></i>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {mounted && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        />
      )}

      {mounted && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          visibility: sidebarOpen ? 'visible' : 'hidden',
        }}
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <Link href="/" prefetch={false} className="flex items-center gap-2 outline-none" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <i className="ri-shield-check-line text-white text-lg"></i>
            </div>
            <span className="text-xl font-bold text-white font-[family-name:var(--font-pacifico)]">QuickGuard</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-700 rounded-lg cursor-pointer" aria-label="Close menu">
            <i className="ri-close-line text-xl text-slate-400"></i>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-700 flex-shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex items-center bg-slate-800 rounded-lg border border-slate-600 focus-within:border-teal-400 transition-all overflow-hidden">
            <div className="w-9 h-9 flex items-center justify-center pl-2">
              <i className="ri-search-line text-slate-400 text-base"></i>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none px-2 py-2"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="w-7 h-7 flex items-center justify-center mr-1 text-slate-400 hover:text-white cursor-pointer">
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </form>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <Link href="/" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/')}>
            <div className={iconClass('/')}><i className="ri-home-4-line text-lg"></i></div>
            Home
          </Link>
          <Link href="/how-it-works" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/how-it-works')}>
            <div className={iconClass('/how-it-works')}><i className="ri-question-line text-lg"></i></div>
            How It Works
          </Link>
          <Link href="/jobs" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/jobs')}>
            <div className={iconClass('/jobs')}><i className="ri-briefcase-line text-lg"></i></div>
            Find Jobs
          </Link>
          <Link href="/pricing" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/pricing')}>
            <div className={iconClass('/pricing')}><i className="ri-price-tag-3-line text-lg"></i></div>
            Pricing
          </Link>
          <Link href="/contact" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/contact')}>
            <div className={iconClass('/contact')}><i className="ri-customer-service-2-line text-lg"></i></div>
            Contact
          </Link>
          <Link href="/help" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/help')}>
            <div className={iconClass('/help')}><i className="ri-lifebuoy-line text-lg"></i></div>
            Help
          </Link>
          <Link href="/qg-launch-rewards" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/qg-launch-rewards')}>
            <div className={iconClass('/qg-launch-rewards')}><i className="ri-rocket-2-line text-lg"></i></div>
            Launch Rewards
          </Link>
          <div className="border-t border-slate-700 my-3"></div>
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest px-3 mb-2">Popular Cities</p>
          <Link href="/security-guards/london" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/london')}>
            <div className={iconClass('/security-guards/london')}><i className="ri-map-pin-line text-lg"></i></div>
            London
          </Link>
          <Link href="/security-guards/manchester" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/manchester')}>
            <div className={iconClass('/security-guards/manchester')}><i className="ri-map-pin-line text-lg"></i></div>
            Manchester
          </Link>
          <Link href="/security-guards/birmingham" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/birmingham')}>
            <div className={iconClass('/security-guards/birmingham')}><i className="ri-map-pin-line text-lg"></i></div>
            Birmingham
          </Link>
          <Link href="/security-guards/leeds" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/leeds')}>
            <div className={iconClass('/security-guards/leeds')}><i className="ri-map-pin-line text-lg"></i></div>
            Leeds
          </Link>
          <Link href="/security-guards/liverpool" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/liverpool')}>
            <div className={iconClass('/security-guards/liverpool')}><i className="ri-map-pin-line text-lg"></i></div>
            Liverpool
          </Link>
          <Link href="/security-guards/glasgow" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/glasgow')}>
            <div className={iconClass('/security-guards/glasgow')}><i className="ri-map-pin-line text-lg"></i></div>
            Glasgow
          </Link>
          <Link href="/security-guards/edinburgh" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/edinburgh')}>
            <div className={iconClass('/security-guards/edinburgh')}><i className="ri-map-pin-line text-lg"></i></div>
            Edinburgh
          </Link>
          <Link href="/security-guards/bristol" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/bristol')}>
            <div className={iconClass('/security-guards/bristol')}><i className="ri-map-pin-line text-lg"></i></div>
            Bristol
          </Link>
          <Link href="/security-guards/cardiff" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/security-guards/cardiff')}>
            <div className={iconClass('/security-guards/cardiff')}><i className="ri-map-pin-line text-lg"></i></div>
            Cardiff
          </Link>

          {loggedInUser ? (
            <>
              <div className="border-t border-slate-700 my-3"></div>
              <div className={`rounded-xl p-3 mb-2 ${loggedInUser.role === 'guard' ? 'bg-emerald-900/40 border border-emerald-700/40' : 'bg-teal-900/40 border border-teal-700/40'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${getRoleColor()} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {loggedInUser.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{loggedInUser.name}</p>
                    <p className="text-xs text-slate-400 truncate">{loggedInUser.email}</p>
                  </div>
                </div>
                <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${loggedInUser.role === 'guard' ? 'bg-emerald-700/60 text-emerald-300' : 'bg-teal-700/60 text-teal-300'}`}>
                  {getRoleBadge()} Account
                </span>
                {loggedInUser.hasBothRoles && (
                  <button
                    onClick={handleSwitchRole}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-slate-800/60 hover:bg-slate-800 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-exchange-line text-sm"></i>
                    Switch to {loggedInUser.role === 'guard' ? 'Client' : 'Guard'} View
                  </button>
                )}
              </div>

              <Link href={getDashboardLink()} prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass(getDashboardLink())}>
                <div className={iconClass(getDashboardLink())}><i className="ri-dashboard-line text-lg"></i></div>
                Dashboard
              </Link>
              <Link href={getProfileLink()} prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass(getProfileLink())}>
                <div className={iconClass(getProfileLink())}><i className="ri-user-line text-lg"></i></div>
                My Profile
              </Link>
              <Link href={getDashboardLink()} prefetch={false} onClick={() => setSidebarOpen(false)} className={`${linkClass(getDashboardLink())} justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-teal-400">
                    <i className="ri-notification-3-line text-lg"></i>
                  </div>
                  Notifications
                </div>
                {unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              {loggedInUser.role === 'guard' && (
                <Link href="/guard/earnings" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/guard/earnings')}>
                  <div className={iconClass('/guard/earnings')}><i className="ri-money-pound-circle-line text-lg"></i></div>
                  Earnings
                </Link>
              )}
              {loggedInUser.role === 'client' && (
                <Link href="/client/jobs" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/client/jobs')}>
                  <div className={iconClass('/client/jobs')}><i className="ri-file-list-3-line text-lg"></i></div>
                  My Jobs
                </Link>
              )}
              <div className="border-t border-slate-700 my-3"></div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-logout-box-r-line text-lg"></i>
                </div>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <div className="border-t border-slate-700 my-3"></div>
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest px-3 mb-2">For Guards</p>
              <Link href="/guard/register" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/guard/register')}>
                <div className={iconClass('/guard/register')}><i className="ri-user-add-line text-lg"></i></div>
                Register as Guard
              </Link>
              <Link href="/guard/login" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/guard/login')}>
                <div className={iconClass('/guard/login')}><i className="ri-login-box-line text-lg"></i></div>
                Guard Login
              </Link>
              <Link href="/guide/guard" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/guide/guard')}>
                <div className={iconClass('/guide/guard')}><i className="ri-book-open-line text-lg"></i></div>
                Guard Guide
              </Link>

              <div className="border-t border-slate-700 my-3"></div>
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest px-3 mb-2">For Clients</p>
              <Link href="/client/register" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/client/register')}>
                <div className={iconClass('/client/register')}><i className="ri-building-line text-lg"></i></div>
                Register as Client
              </Link>
              <Link href="/client/login" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/client/login')}>
                <div className={iconClass('/client/login')}><i className="ri-login-box-line text-lg"></i></div>
                Client Login
              </Link>
              <Link href="/guide/client" prefetch={false} onClick={() => setSidebarOpen(false)} className={linkClass('/guide/client')}>
                <div className={iconClass('/guide/client')}><i className="ri-book-open-line text-lg"></i></div>
                Client Guide
              </Link>
            </>
          )}

          <div className="border-t border-slate-700 my-3"></div>
          <Link href="/admin/login" prefetch={false} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium cursor-pointer outline-none ${pathname === '/admin/login' ? 'bg-red-700 text-white' : 'hover:bg-slate-700 text-slate-500 hover:text-red-400'}`}>
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-shield-user-line text-lg"></i>
            </div>
            Admin Login
          </Link>
        </nav>
      </div>
      )}

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        userType={loginUserType}
      />
    </>
  );
}