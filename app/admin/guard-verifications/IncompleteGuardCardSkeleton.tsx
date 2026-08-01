'use client';

import { SkeletonCircle, SkeletonLine, SkeletonBadge } from './SkeletonPrimitives';

export default function IncompleteGuardCardSkeleton() {
  return (
    <div className="bg-[#111d35] rounded-xl border-2 border-amber-500/10 p-6">
      <div className="flex items-start gap-4">
        <SkeletonCircle size="w-16 h-16" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonLine width="w-36" height="h-5" />
            <SkeletonLine width="w-32" height="h-5" />
          </div>
          <div className="space-y-2">
            <SkeletonLine width="w-56" height="h-4" />
            <SkeletonLine width="w-36" height="h-4" />
          </div>
          <div className="space-y-2">
            <SkeletonLine width="w-full" height="h-2" />
            <SkeletonLine width="w-24" height="h-4" />
          </div>
          <SkeletonBadge count={4} />
          <SkeletonLine width="w-full" height="h-16" />
        </div>
      </div>
    </div>
  );
}