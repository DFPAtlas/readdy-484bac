'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="font-['Pacifico'] text-4xl text-teal-400 mb-8">QuickGuard</div>
        <div className="text-6xl font-bold text-teal-400 mb-4">Oops!</div>
        <h1 className="text-2xl font-semibold text-white mb-2">Something went wrong</h1>
        <p className="text-slate-400 mb-6">
          We&apos;re sorry for the inconvenience. An error occurred while loading this page.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg font-medium transition cursor-pointer whitespace-nowrap"
        >
          Try again
        </button>
        <p className="text-xs text-slate-500 mt-6">
          If this persists, please contact{' '}
          <a href="mailto:support@quickguard.uk" className="text-teal-400 hover:underline">
            support@quickguard.uk
          </a>
        </p>
      </div>
    </div>
  );
}