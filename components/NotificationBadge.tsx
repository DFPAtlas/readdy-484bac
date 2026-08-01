import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationBadgeProps {
  userId?: string | null;
  userType?: string;
}

export default function NotificationBadge({ userId, userType }: NotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let mounted = true;
    const uid = userId;

    const fetchCount = async () => {
      let resolvedUid = uid;
      if (!resolvedUid) {
        const { data: { user } } = await supabase.auth.getUser();
        resolvedUid = user?.id;
      }
      if (!resolvedUid) return;

      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', resolvedUid)
        .eq('is_read', false);

      if (userType) {
        query = query.eq('user_type', userType);
      }

      const { count: unreadCount } = await query;
      if (mounted) setCount(unreadCount || 0);
    };

    fetchCount();

    const setupChannel = async () => {
      let resolvedUid = uid;
      if (!resolvedUid) {
        const { data: { user } } = await supabase.auth.getUser();
        resolvedUid = user?.id;
      }
      if (!resolvedUid) return;

      const channelName = `notif-badge-${resolvedUid}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'app',
            table: 'notifications',
            filter: `user_id=eq.${resolvedUid}`,
          },
          () => fetchCount()
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      mounted = false;
      const ch = channelRef.current;
      if (ch) {
        supabase.removeChannel(ch);
        channelRef.current = null;
      }
    };
  }, [userId, userType]);

  if (count === 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );
}