'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning'>('all');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('digital_footprint_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications(data || []);
    setLoading(false);
  };

  const handleMarkRead = async (id: string) => {
    await supabase
      .from('digital_footprint_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    fetchAll();
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('digital_footprint_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
    fetchAll();
  };

  const getSeverity = (severity: string) => {
    switch (severity) {
      case 'critical': return { icon: 'ri-close-circle-line', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critical' };
      case 'warning': return { icon: 'ri-error-warning-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' };
      case 'info': return { icon: 'ri-information-line', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', label: 'Info' };
      default: return { icon: 'ri-notification-3-line', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: 'System' };
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' minutes ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hours ago';
    return Math.floor(hrs / 24) + ' days ago';
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'warning') return n.severity === 'warning';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical').length;
  const warningCount = notifications.filter((n) => n.severity === 'warning').length;

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/admin/digital-footprint" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer">
                <i className="ri-arrow-left-line"></i>
              </Link>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-900/50">
                <i className="ri-notification-3-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Notifications</h1>
                <p className="text-[11px] text-slate-500 font-medium">Digital-Footprint alerts &amp; updates</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'critical', label: 'Critical', count: criticalCount },
              { key: 'warning', label: 'Warnings', count: warningCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                  filter === tab.key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-[#111d35] text-slate-400 border-[#1a2b4a] hover:text-white hover:border-indigo-500/30'
                }`}
              >
                {tab.label}
                <span className={`text-[9px] ${filter === tab.key ? 'text-white/70' : 'text-slate-600'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-all cursor-pointer whitespace-nowrap border border-indigo-500/20"
            >
              <div className="w-3 h-3 flex items-center justify-center"><i className="ri-check-double-line text-[9px]"></i></div>
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 flex items-center justify-center text-indigo-400">
              <i className="ri-loader-4-line animate-spin text-2xl"></i>
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[#111d35] rounded-2xl border border-[#1a2b4a]">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-600">
              <i className="ri-notification-off-line text-2xl"></i>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              {filter === 'all' ? 'Awaiting notification data' : 'No matching notifications'}
            </p>
            <p className="text-[11px] text-slate-600">
              {filter === 'all'
                ? 'Notifications will appear here when triggered by system events'
                : 'Try changing the filter'}
            </p>
          </div>
        ) : (
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
            <div className="divide-y divide-[#1a2b4a]">
              {filteredNotifications.map((n) => {
                const sev = getSeverity(n.severity);
                return (
                  <div
                    key={n.id}
                    className={`px-5 py-4 transition-colors ${!n.read_at ? 'bg-indigo-500/5' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 ${sev.bg} ${sev.color}`}>
                        <i className={sev.icon + ' text-lg'}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{n.title}</h3>
                          {!n.read_at && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0"></span>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sev.bg} ${sev.color} ${sev.border}`}>
                            {sev.label}
                          </span>
                          <span className="text-[9px] text-slate-600">{n.notification_type}</span>
                        </div>
                        {n.message && (
                          <p className="text-[11px] text-slate-400 mb-2">{n.message}</p>
                        )}
                        <div className="flex items-center gap-3 text-[9px] text-slate-600">
                          <span>{n.app_slug}</span>
                          <span>{timeAgo(n.created_at)}</span>
                          {!n.read_at && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-semibold whitespace-nowrap"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}