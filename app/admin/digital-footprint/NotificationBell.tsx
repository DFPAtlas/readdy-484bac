'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  app_slug: string;
  severity: string;
  notification_type: string;
  title: string;
  message: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  isSuperAdmin: boolean;
}

export default function NotificationBell({ isSuperAdmin }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('digital_footprint_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isSuperAdmin]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkRead = async (id: string) => {
    await supabase
      .from('digital_footprint_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('digital_footprint_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
    fetchNotifications();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return { icon: 'ri-close-circle-line', color: 'text-red-400' };
      case 'warning': return { icon: 'ri-error-warning-line', color: 'text-amber-400' };
      case 'info': return { icon: 'ri-information-line', color: 'text-sky-400' };
      default: return { icon: 'ri-notification-3-line', color: 'text-slate-400' };
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] border border-[#1a2b4a] text-slate-400 hover:text-white hover:border-indigo-500/40 transition-all cursor-pointer"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-notification-3-line text-base"></i>
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111d35] border border-[#1a2b4a] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2b4a]">
            <h4 className="text-xs font-bold text-white">Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer whitespace-nowrap"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 flex items-center justify-center text-slate-500">
                  <i className="ri-loader-4-line animate-spin text-sm"></i>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-600">
                  <i className="ri-notification-off-line text-lg"></i>
                </div>
                <p className="text-[10px] text-slate-500">Awaiting notification data</p>
              </div>
            ) : (
              notifications.map((n) => {
                const sev = getSeverityIcon(n.severity);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#1a2b4a]/50 transition-colors cursor-pointer ${
                      !n.read_at ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-[#0a1628]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5 ${sev.color}`}>
                        <i className={sev.icon + ' text-sm'}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-semibold text-white truncate">{n.title}</span>
                          {!n.read_at && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0"></span>
                          )}
                        </div>
                        {n.message && (
                          <p className="text-[10px] text-slate-400 line-clamp-2">{n.message}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-600">{n.app_slug}</span>
                          <span className="text-[9px] text-slate-600">{timeAgo(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-[#1a2b4a]">
            <a
              href="/admin/digital-footprint/notifications"
              className="block text-center text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-all py-1"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}