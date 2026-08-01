import { Suspense } from 'react';
import ActivityLogClient from './ActivityLogClient';

export default function ActivityLogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ActivityLogClient />
    </Suspense>
  );
}