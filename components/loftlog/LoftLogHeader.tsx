'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function LoftLogHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <i className="ri-home-4-line text-base"></i>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">LoftLog</span>
        </div>

        <div className="relative flex-1 max-w-xl">
          <div
            className={`flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 cursor-text transition-all ${
              searchOpen ? 'ring-2 ring-teal-500 bg-white' : 'hover:bg-gray-200'
            }`}
            onClick={() => setSearchOpen(true)}
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, boxes, racks... (Ctrl+K)"
              className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 flex-1"
              onFocus={() => setSearchOpen(true)}
              onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
            />
            <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded hidden sm:inline">⌘K</span>
          </div>

          {searchOpen && searchQuery && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 max-h-80 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Items</div>
              <div className="px-3 py-2 text-sm text-gray-400">Type to search across all records...</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Synced
        </div>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="ri-notification-3-line text-gray-600 text-lg"></i>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="p-4 border-b border-gray-100">
                <p className="font-semibold text-gray-800">Notifications</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                  <p className="text-sm font-medium text-gray-700">AI review needed</p>
                  <p className="text-xs text-gray-500 mt-0.5">1 item pending identification</p>
                  <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                  <p className="text-sm font-medium text-gray-700">Loan return due</p>
                  <p className="text-xs text-gray-500 mt-0.5">LED Christmas Lights - due 15 Jan</p>
                  <p className="text-xs text-gray-400 mt-1">Yesterday</p>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                  <p className="text-sm font-medium text-gray-700">Storage warning</p>
                  <p className="text-xs text-gray-500 mt-0.5">Camping Gas Stove - unacknowledged</p>
                  <p className="text-xs text-gray-400 mt-1">3 days ago</p>
                </div>
              </div>
              <div className="p-3 border-t border-gray-100">
                <Link href="/loftlog/notifications" className="text-sm text-teal-600 hover:text-teal-700 font-medium block text-center">
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link
          href="/loftlog/help"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <i className="ri-question-line text-gray-600 text-lg"></i>
        </Link>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">AM</span>
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">Alex</span>
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-down-s-line text-gray-400 text-sm"></i>
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-2">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Alex Morgan</p>
                <p className="text-xs text-gray-500">owner@loftlog.demo</p>
              </div>
              <Link href="/loftlog/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-settings-3-line text-gray-400"></i></span>
                Settings
              </Link>
              <Link href="/loftlog/settings/users" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-user-settings-line text-gray-400"></i></span>
                Users & Access
              </Link>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line"></i></span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}