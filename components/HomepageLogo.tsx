'use client';

import { useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

const HOMEPAGE_LOGO_SRC =
  'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/5b8bf6ae-e0fb-4726-93c3-167ed96d0716_compressed_quickguard-home-transparent-600-1.webp';

export default function HomepageLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <BrandLogo variant="full" theme="dark" imgClassName="h-16 w-auto" />;
  }

  return (
    <img
      src={HOMEPAGE_LOGO_SRC}
      alt="QuickGuard — SIA-licensed security guards, booked by the shift"
      width={600}
      height={200}
      fetchPriority="high"
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-16 w-auto object-contain select-none"
    />
  );
}