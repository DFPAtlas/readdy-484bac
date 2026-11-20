'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/lib/ClientAuthContext';

export default function ClientAccountStatusPage() {
  const { userId } = useClientAuth();
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true); setError('');
    try {
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      window.location.assign('/client/login');
    } catch { setError('Sign out could not be confirmed. Please retry.'); setLeaving(false); }
  };
  return <main className="min-h-screen flex items-center justify-center bg-[#0B1933] px-6 text-white">
    <div className="max-w-md space-y-5 text-center">
      <h1 className="text-2xl font-bold">Client account access restricted</h1>
      <p>Your client account is inactive or suspended. Contact QuickGuard support for help restoring access.</p>
      <Link href="/contact" className="inline-block rounded-lg bg-teal-600 px-5 py-3">Contact QuickGuard support</Link>
      {userId ? <button onClick={() => void signOut()} disabled={leaving} className="block mx-auto underline">{leaving ? 'Signing out…' : 'Sign out'}</button> : <Link href="/client/login" className="block underline">Client sign in</Link>}
      {error && <p role="alert">{error}</p>}
    </div>
  </main>;
}
