'use client';

import { useEffect, useState } from 'react';
import QuickGuardImage from '@/components/QuickGuardImage';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof QuickGuardImage> & { slot: string; src: string };
type Publication = { slot_key: string; version_id: string };
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
let pending: Promise<Publication[]> | undefined;
let expires = 0;
function publications(): Promise<Publication[]> {
  if (!base) return Promise.resolve([]);
  if (pending && Date.now() < expires) return pending;
  expires = Date.now() + 15000;
  pending = fetch(base + '/functions/v1/public-site-media', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000) })
    .then(async response => {
      if (!response.ok) return [];
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('publications' in body) || !Array.isArray(body.publications)) return [];
      return body.publications.filter((v): v is Publication => v && typeof v.slot_key === 'string' && typeof v.version_id === 'string' && /^[0-9a-f-]{36}$/i.test(v.version_id));
    }).catch(() => []);
  return pending;
}

export function usePublicMediaSource(slot: string, src: string) {
  const [replacement, setReplacement] = useState<{ slot: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    void publications().then(items => {
      const match = items.find(item => item.slot_key === slot);
      if (active) setReplacement(base && match ? { slot, url: base + '/functions/v1/public-site-media?slot=' + encodeURIComponent(slot) + '&v=' + encodeURIComponent(match.version_id) } : null);
    });
    return () => { active = false; };
  }, [slot, src]);
  const chosen = replacement?.slot === slot ? replacement.url : src;
  return { chosen, reset: () => setReplacement(null) };
}

export default function PublicMediaImage({ slot, src, onError, ...props }: Props) {
  const { chosen, reset } = usePublicMediaSource(slot, src);
  return <QuickGuardImage {...props} src={chosen} onError={event => {
    if (chosen !== src) reset();
    else onError?.(event);
  }} />;
}
