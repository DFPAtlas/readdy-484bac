'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoginMarketingPanel from '@/components/login/LoginMarketingPanel';
import LoginFormCard from '@/components/login/LoginFormCard';
import BrandLogo from '@/components/BrandLogo';

export default function CompanyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'company-profile-not-found') {
      setError('This account is not linked to a company profile. Please contact QuickGuard support.');
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Login failed. Please try again.');

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!company) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('This account is not linked to a company profile. Please contact QuickGuard support.');
      }

      router.replace('/company/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#071321]">
      <LoginMarketingPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center" aria-label="QuickGuard home">
              <BrandLogo variant="full" theme="dark" imgClassName="h-8 w-auto" />
            </Link>
          </div>

          <LoginFormCard userTypeLabel="Security Company Portal" formId="company-login-card">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 flex items-start gap-2.5">
                <i className="ri-error-warning-line text-red-400 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form id="company-login-form" onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="company-email" className="block text-sm font-medium text-[#AAB7C4] mb-2">Email Address</label>
                <input
                  id="company-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#071321]/60 border border-white/10 text-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="company-password" className="block text-sm font-medium text-[#AAB7C4] mb-2">Password</label>
                <div className="relative">
                  <input
                    id="company-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-[#071321]/60 border border-white/10 text-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-400 hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-[#071321] font-bold transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in to Company Portal'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Company access is issued by a QuickGuard administrator.{' '}
              <Link href="/contact" className="text-teal-400 hover:underline">Contact support</Link>
            </p>
          </LoginFormCard>
        </div>
      </div>
    </div>
  );
}
