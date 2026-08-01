'use client';

export function SkeletonPulse({ className }: { className: string }) {
  return <div className={`bg-[#1a2b4a] rounded animate-pulse ${className}`} />;
}

export function SkeletonLine({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`bg-[#1a2b4a] rounded animate-pulse ${width} ${height}`} />;
}

export function SkeletonCircle({ size = 'w-12 h-12' }: { size?: string }) {
  return <div className={`bg-[#1a2b4a] rounded-full animate-pulse ${size}`} />;
}

export function SkeletonBadge({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} width="w-20" height="h-6" />
      ))}
    </div>
  );
}