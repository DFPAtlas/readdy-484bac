'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function EmailDashboardPage() {
  const started = useRef(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token_hash');
    const role = params.get('role');
    setRole(role || '');
    window.history.replaceState(null, '', window.location.pathname);
    async function signIn() {
      if (!token || (role !== 'client' && role !== 'guard')) throw new Error('This sign-in link is invalid.');
      const { data, error: authError } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' });
      if (authError || !data.session) throw new Error('This sign-in link has expired or has already been used. Please sign in normally.');
      const { data: profile, error: profileError } = await supabase.from(role === 'client' ? 'clients' : 'guards')
        .select('user_id, profile_completed').eq('user_id', data.session.user.id).maybeSingle();
      if (profileError || !profile) throw new Error('This account cannot access the requested dashboard.');
      if (profile.profile_completed !== true) {
        window.location.replace(role === 'client' ? '/client/complete-profile-wizard' : '/guard/complete-profile-wizard');
        return;
      }
      window.location.replace(role === 'client' ? '/client/dashboard' : '/guard/dashboard');
    }
    signIn().catch((err: Error) => setError(err.message));
  }, []);
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{error ? 'Sign-in link unavailable' : 'Opening your dashboard'}</h1>
      <p className="mt-4 text-slate-600">{error || 'Verifying your secure QuickGuard sign-in link…'}</p>
      {error && <div className="mt-6 flex flex-wrap justify-center gap-4"><a className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white" href="/client/login">Client sign-in</a><a className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white" href="/guard/login">Guard sign-in</a><a className="rounded-lg border border-teal-700 px-5 py-3 font-semibold text-teal-700" href={role ? `/auth/verify-email?role=${role}` : '/auth/verify-email'}>Send a new link</a></div>}
    </div>
  </main>;
}
