'use client';

import { SkeletonCircle, SkeletonLine, SkeletonBadge } from './SkeletonPrimitives';

export default function GuardCardSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0 rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-4 space-y-4">
      <div className="flex gap-3">
        <SkeletonCircle />
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonLine width="w-3/4" />
          <SkeletonLine height="h-3" />
          <SkeletonLine width="w-1/2" height="h-3" />
        </div>
      </div>
      <SkeletonBadge count={2} />
      <div className="space-y-3 rounded-xl bg-[#0a1628] p-3">
        <SkeletonLine width="w-3/4" />
        <SkeletonLine />
        <SkeletonLine />
        <SkeletonLine width="w-2/3" />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3"><SkeletonLine height="h-10" /><SkeletonLine height="h-10" /></div>
    </div>
  );
}
