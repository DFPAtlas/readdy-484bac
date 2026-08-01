'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NotificationBell from './NotificationBell';
import { Guard } from './types';

interface Props {
  guard: Guard | null;
  isAdmin: boolean;
  guardUserId: string | null;
  onLogout: () => void;
}

export default function DashboardHeader({ guard, isAdmin, guardUserId, onLogout }: Props) {
  const displayName = guard?.full_name || (isAdmin ? 'Admin Preview' : 'Guard');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      );
    }
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {getGreeting()}, {displayName.split(' ')[0]} <span className="inline-block">👋</span>
          </h1>
          <p className="text-sm text-slate-400">{currentTime}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isAdmin && guardUserId && <NotificationBell guardUserId={guardUserId} />}
          <Link
            href="/guard/earnings"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-medium hover:bg-[#162036] hover:border-[#2a3e5f] transition-all cursor-pointer whitespace-nowrap"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-wallet-3-line text-slate-400"></i>
            </div>
            Earnings
          </Link>
          <Link
            href="/guard/profile"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-medium hover:bg-[#162036] hover:border-[#2a3e5f] transition-all cursor-pointer whitespace-nowrap"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-user-settings-line text-slate-400"></i>
            </div>
            Profile
          </Link>
          {!isAdmin && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-logout-box-line"></i>
              </div>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}