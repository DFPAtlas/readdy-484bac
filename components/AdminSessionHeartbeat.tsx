'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminSessionHeartbeatProps {
  adminUserId: string;
  adminEmail: string;
}

function parseBrowser(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

  if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('macOS')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

export default function AdminSessionHeartbeat({ adminUserId, adminEmail }: AdminSessionHeartbeatProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!adminUserId) return;

    const ping = async () => {
      try {
        const ua = navigator.userAgent || '';
        const { browser, os } = parseBrowser(ua);

        await supabase.functions.invoke('security-dashboard', {
          body: {
            action: 'track_admin_session',
            session_id: null,
            ip_address: null,
            user_agent: ua.substring(0, 512),
            browser,
            os,
            country: null,
          },
        });
      } catch {
        // fire-and-forget — never block the UI
      }
    };

    ping();

    intervalRef.current = setInterval(ping, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [adminUserId, adminEmail]);

  return null;
}