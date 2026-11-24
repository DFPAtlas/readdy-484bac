'use client';
import { useEffect, useState } from 'react';
import { usePublicMediaSource } from '@/components/PublicMediaImage';

// Preload a replacement before changing a CSS background; retain the original
// when the resolver or image request fails.
export function usePublicMediaBackground(slot: string, original: string): string {
  const { chosen } = usePublicMediaSource(slot, original);
  const [ready, setReady] = useState('');
  useEffect(() => {
    if (chosen === original) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setReady(chosen); };
    image.onerror = () => { if (active) setReady(''); };
    image.src = chosen;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [chosen, original]);
  return chosen !== original && ready === chosen ? chosen : original;
}
