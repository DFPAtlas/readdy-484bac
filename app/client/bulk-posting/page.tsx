'use client';

import { Suspense } from 'react';
import BulkPostingClient from './BulkPostingClient';

function BulkPostingFallback() {
  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
      <div className="text-center">
        <i className="ri-loader-4-line text-5xl text-teal-400 animate-spin" />
        <p className="mt-4 text-slate-400">Loading bulk posting...</p>
      </div>
    </div>
  );
}

export default function BulkPostingPage() {
  return (
    <Suspense fallback={<BulkPostingFallback />}>
      <BulkPostingClient />
    </Suspense>
  );
}