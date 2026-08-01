import { Suspense } from 'react';
import SupportPage from './SupportPage';

export default function SupportWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading support centre…</p>
        </div>
      </div>
    }>
      <SupportPage />
    </Suspense>
  );
}