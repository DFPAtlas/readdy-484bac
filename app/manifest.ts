import type { MetadataRoute } from 'next';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'Hire SIA-licensed security guards directly across the UK.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1933',
    theme_color: '#0B1933',
    icons: [
      { src: BRAND_LOGO.appIcon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: BRAND_LOGO.appIcon, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  };
}