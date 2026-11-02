'use client';

import Image, { type ImageProps } from 'next/image';
import { forwardRef } from 'react';

type QuickGuardImageProps = Omit<ImageProps, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

/**
 * Compatibility wrapper for user-uploaded and signed images.
 *
 * QuickGuard displays short-lived Supabase URLs, browser object URLs and data
 * URLs throughout authenticated journeys. Those sources cannot use the
 * server-side Next.js optimiser safely, so this wrapper keeps Next Image's
 * sizing and loading behaviour while serving the original source unchanged.
 */
const QuickGuardImage = forwardRef<HTMLImageElement, QuickGuardImageProps>(
  function QuickGuardImage(
    { width = 1, height = 1, unoptimized = true, alt, ...props },
    ref,
  ) {
    return (
      <Image
        ref={ref}
        width={width}
        height={height}
        unoptimized={unoptimized}
        alt={alt}
        {...props}
      />
    );
  },
);

export default QuickGuardImage;
