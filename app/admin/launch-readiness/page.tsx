'use client';

import { useEffect } from 'react';
import { useSafeRouter } from '@/hooks/useSafeRouter';

export default function LaunchReadinessRedirect() {
  const router = useSafeRouter();

  useEffect(() => {
    router.replace('/admin/live-test-checklist');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent mx-auto"></div>
        <p className="mt-4 text-slate-400 text-sm font-medium">Redirecting to Launch Readiness...</p>
      </div>
    </div>
  );
}