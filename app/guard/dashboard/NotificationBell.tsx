'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

interface NotificationBellProps {
  guardUserId: string;
}

export default function NotificationBell({ guardUserId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`guard-notifications-${guardUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'app',
          table: 'notifications',
          filter: `user_id=eq.${guardUserId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'app',
          table: 'notifications',
          filter: `user_id=eq.${guardUserId}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? { ...n, ...(payload.new as Notification) } : n)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guardUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, link, created_at')
        .eq('user_id', guardUserId)
        .eq('user_type', 'guard')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error) setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getTypeIcon = (type: string) => {
    const map: Record<string, { icon: string; color: string; bg: string }> = {
      job_match: { icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15' },
      job_offer: { icon: 'ri-gift-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
      application_update: { icon: 'ri-file-list-line', color: 'text-blue-400', bg: 'bg-blue-500/15' },
      payment: { icon: 'ri-money-pound-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
      message: { icon: 'ri-message-3-line', color: 'text-purple-400', bg: 'bg-purple-500/15' },
      verification: { icon: 'ri-shield-check-line', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    };
    return map[type] || { icon: 'ri-notification-3-line', color: 'text-slate-400', bg: 'bg-[#162036]' };
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full border border-[#1e2d4d] bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <i className="ri-notification-3-line text-xl text-slate-400"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-[#111d35] rounded-2xl shadow-2xl border border-[#1e2d4d] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4d]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs font-semibold rounded-full border border-red-500/25">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line text-3xl text-teal-400 animate-spin"></i>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-14 h-14 bg-[#162036] rounded-full flex items-center justify-center mb-3">
                  <i className="ri-notification-off-line text-2xl text-slate-600"></i>
                </div>
                <p className="text-slate-400 text-sm">No notifications yet</p>
                <p className="text-slate-500 text-xs mt-1">Job match alerts will appear here</p>
              </div>
            ) : (
              notifications.map(n => {
                const { icon, color, bg } = getTypeIcon(n.type);
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (n.link) setOpen(false);
                    }}
                    className={`flex gap-3 px-5 py-4 border-b border-[#1e2d4d] cursor-pointer transition-colors ${
                      !n.is_read ? 'bg-teal-500/5 hover:bg-teal-500/10' : 'hover:bg-[#162036]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <i className={`${icon} text-base ${color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${!n.is_read ? 'text-white' : 'text-slate-400'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-teal-400 rounded-full flex-shrink-0 mt-1"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-slate-500">{timeAgo(n.created_at)}</span>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              markAsRead(n.id);
                              setOpen(false);
                            }}
                            className="text-[11px] text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap"
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-5 py-3 border-t border-[#1e2d4d] bg-[#0B1933]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {notifications.length > 0 ? `Last ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}` : 'No notifications'}
              </p>
              <Link
                href="/guard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap"
              >
                View All →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
