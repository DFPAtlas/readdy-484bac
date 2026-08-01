'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ProfileAvatarProps {
  path: string | null;
}

export default function ProfileAvatar({ path }: ProfileAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    async function loadSignedUrl() {
      try {
        const { data, error } = await supabase.storage
          .from('guard-profiles')
          .createSignedUrl(path, 3600);
        if (!cancelled) {
          if (error) setError(true);
          else setSignedUrl(data.signedUrl);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    loadSignedUrl();
    return () => { cancelled = true; };
  }, [path]);

  if (!path || error || !signedUrl) {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <i className="ri-shield-user-line text-2xl text-slate-400"></i>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt="Profile"
      className="w-full h-full object-cover"
    />
  );
}