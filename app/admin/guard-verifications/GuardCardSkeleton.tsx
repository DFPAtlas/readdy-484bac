'use client';

import { SkeletonCircle, SkeletonLine, SkeletonBadge } from './SkeletonPrimitives';

export default function GuardCardSkeleton() {
  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <SkeletonCircle size="w-16 h-16" />
          <div className="flex-1 space-y-3">
            <SkeletonLine width="w-48" height="h-5" />
            <div className="space-y-2">
              <SkeletonLine width="w-56" height="h-4" />
              <SkeletonLine width="w-40" height="h-4" />
              <SkeletonLine width="w-64" height="h-4" />
              <SkeletonLine width="w-36" height="h-4" />
            </div>
            <SkeletonBadge count={2} />
          </div>
        </div>
        <SkeletonLine width="w-36" height="h-10" />
      </div>
    </div>
  );
}