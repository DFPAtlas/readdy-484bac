'use client';

import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';
import { INDUSTRY_MEDIA_ORIGINALS } from '@/lib/industry-media-originals';

const original = INDUSTRY_MEDIA_ORIGINALS['city-london-hero'] ?? '';

const linearOverlay = {
  background:
    'linear-gradient(180deg, rgba(8,21,44,0.88) 0%, rgba(9,23,46,0.66) 42%, rgba(11,25,51,0.96) 100%)',
};

const radialOverlay = {
  background:
    'radial-gradient(ellipse 78% 70% at 50% 42%, rgba(8,21,44,0.9) 0%, rgba(9,23,46,0.55) 58%, rgba(11,25,51,0.18) 100%)',
};

export default function PostJobBackdrop() {
  const backdropSrc = usePublicMediaBackground('city-london-hero', original);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0B1933]"
    >
      {backdropSrc ? (
        <img
          src={backdropSrc}
          alt=""
          loading="eager"
          decoding="async"
          className="hidden h-full w-full object-cover object-top opacity-85 sm:block"
        />
      ) : null}
      <div className="absolute inset-0" style={linearOverlay} />
      <div className="absolute inset-0" style={radialOverlay} />
    </div>
  );
}