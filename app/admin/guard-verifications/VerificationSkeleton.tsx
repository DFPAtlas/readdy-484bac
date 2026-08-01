'use client';

import { SkeletonCircle, SkeletonLine } from './SkeletonPrimitives';

export default function VerificationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#111d35] to-[#162036] rounded-xl p-6 border border-[#1a2b4a]">
        <div className="flex items-start gap-4">
          <SkeletonCircle size="w-20 h-20" />
          <div className="flex-1 space-y-3">
            <SkeletonLine width="w-48" height="h-6" />
            <SkeletonLine width="w-72" height="h-4" />
            <div className="flex gap-2">
              <SkeletonLine width="w-32" height="h-5" />
              <SkeletonLine width="w-32" height="h-5" />
              <SkeletonLine width="w-32" height="h-5" />
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonLine width="w-16" height="h-3" />
            <SkeletonLine width="w-20" height="h-4" />
          </div>
        </div>
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-[#111d35] border-2 border-[#1a2b4a] rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-10 h-10" />
              <div className="space-y-2">
                <SkeletonLine width="w-40" height="h-5" />
                <SkeletonLine width="w-56" height="h-4" />
              </div>
            </div>
            <SkeletonLine width="w-24" height="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SkeletonLine width="w-full" height="h-4" />
            <SkeletonLine width="w-full" height="h-4" />
            <SkeletonLine width="w-full" height="h-4" />
            <SkeletonLine width="w-full" height="h-4" />
          </div>
        </div>
      ))}

      <div className="flex gap-4 pt-4">
        <SkeletonLine width="w-full" height="h-14" />
        <SkeletonLine width="w-full" height="h-14" />
      </div>
    </div>
  );
}