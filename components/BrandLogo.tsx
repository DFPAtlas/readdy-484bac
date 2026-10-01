'use client';

import { useState } from 'react';
import { BRAND_LOGO, BRAND_LOGO_LEGACY, BRAND_NAME } from '@/lib/brand';

type BrandVariant = 'full' | 'symbol';
type BrandTheme = 'light' | 'dark';

interface BrandLogoProps {
  variant?: BrandVariant;
  theme?: BrandTheme;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export default function BrandLogo({
  variant = 'full',
  theme = 'light',
  className = '',
  imgClassName = '',
  alt = BRAND_NAME,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  const src = failed
    ? BRAND_LOGO_LEGACY
    : variant === 'symbol'
      ? theme === 'dark'
        ? BRAND_LOGO.symbolDark
        : BRAND_LOGO.symbolLight
      : theme === 'dark'
        ? BRAND_LOGO.fullDark
        : BRAND_LOGO.fullLight;

  const sizeClass = variant === 'symbol' ? 'h-9 w-9' : 'h-9 w-auto';

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={`${sizeClass} object-contain select-none ${imgClassName} ${className}`.trim()}
    />
  );
}