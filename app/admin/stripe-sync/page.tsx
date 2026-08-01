'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';


export default function StripeSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const accessToken = adminSession?.access_token;
      if (!accessToken) {
        setResult({ success: false, message: 'Admin session expired. Please log in again.' });
        setSyncing(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-stripe-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({}),
        }
      );

      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message || 'Sync completed successfully.' });
      } else {
        setResult({ success: false, message: data.error || 'Sync failed. Check the edge function logs.' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Make sure the edge function is deployed.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-exchange-dollar-line text-3xl text-teal-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Stripe Price Sync</h1>
          <p className="text-sm text-slate-500 mb-8">
            Creates real Stripe Products and Prices for every paid plan in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">app.plans</code> and writes the real IDs back into the database.
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white text-sm font-semibold py-3 rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            {syncing ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <i className="ri-refresh-line" />
                Run Sync
              </>
            )}
          </button>

          {result && (
            <div className={`mt-6 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              result.success
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-400/20'
                : 'bg-red-500/10 text-red-600 border border-red-400/20'
            }`}>
              <i className={result.success ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} />
              {result.message}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 text-sm text-slate-400">
            <p className="mb-3">Then verify the IDs got updated:</p>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 text-teal-500 font-medium hover:underline"
            >
              <i className="ri-arrow-left-line" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}