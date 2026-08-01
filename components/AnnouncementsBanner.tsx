'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  message: string;
  target_audience: 'all' | 'clients' | 'guards';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
}

const priorityStyles: Record<string, { border: string; icon: string; accent: string; bg: string }> = {
  urgent: { border: 'border-red-500/30', icon: 'ri-alarm-warning-line text-red-400', accent: 'bg-red-500', bg: 'bg-red-500/10' },
  high:   { border: 'border-orange-500/30', icon: 'ri-error-warning-line text-orange-400', accent: 'bg-orange-500', bg: 'bg-orange-500/10' },
  normal: { border: 'border-blue-500/30', icon: 'ri-information-line text-blue-400', accent: 'bg-blue-500', bg: 'bg-blue-500/10' },
  low:    { border: 'border-slate-500/30', icon: 'ri-notification-4-line text-slate-400', accent: 'bg-slate-500', bg: 'bg-slate-500/10' },
};

interface AnnouncementsBannerProps {
  audience: 'clients' | 'guards';
  wrapperClass?: string;
}

export default function AnnouncementsBanner({ audience, wrapperClass }: AnnouncementsBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user and dismissed announcements
  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    setUserId(uid);

    // Fetch active announcements for this audience
    const { data: anns } = await supabase
      .from('announcements')
      .select('id, title, message, target_audience, priority, created_at')
      .eq('is_active', true)
      .in('target_audience', ['all', audience])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (anns) setAnnouncements(anns);

    if (uid) {
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', uid)
        .eq('dismissed', true);
      if (reads) {
        setDismissedIds(new Set(reads.map((r) => r.announcement_id)));
      }
    }

    setLoading(false);
  }, [audience]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to new announcements
  useEffect(() => {
    const channel = supabase
      .channel(`announcements-${audience}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'announcements' },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [audience, load]);

  async function dismiss(id: string) {
    if (userId) {
      await supabase.from('announcement_reads').upsert(
        { user_id: userId, announcement_id: id, dismissed: true, read_at: new Date().toISOString() },
        { onConflict: 'user_id,announcement_id' }
      );
    }
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const visible = announcements.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className={wrapperClass || 'space-y-3 mb-8'}>
      {visible.map((item) => {
        const p = priorityStyles[item.priority] || priorityStyles.normal;
        return (
          <div
            key={item.id}
            className={`relative bg-[#111d35] border ${p.border} rounded-xl p-4 flex items-start gap-3`}
          >
            <div className={`w-8 h-8 ${p.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <i className={p.icon}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.message}</p>
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition cursor-pointer flex-shrink-0"
              title="Dismiss"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}