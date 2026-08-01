'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RoleSwitchModalProps {
  targetRole: 'guard' | 'client';
}

export default function RoleSwitchModal({ targetRole }: RoleSwitchModalProps) {
  const router = useRouter();
  const isGuardTarget = targetRole === 'guard';

  const handleCreateAccount = () => {
    sessionStorage.setItem(
      'oauth_callback_intent',
      JSON.stringify({ type: targetRole, isNewUser: true, useWizard: true })
    );
    router.push(isGuardTarget ? '/guard/login' : '/client/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0B1933]">
      <div className="w-full max-w-md bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className={`${isGuardTarget ? 'ri-shield-user-fill' : 'ri-briefcase-4-fill'} text-2xl text-amber-400`}></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          {isGuardTarget ? 'Client Account Detected' : 'Guard Account Detected'}
        </h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          Your current account is set up as a <strong className="text-white">{isGuardTarget ? 'client' : 'guard'}</strong>.
          To access this page, you need a separate {isGuardTarget ? 'guard' : 'client'} profile.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleCreateAccount}
            className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 py-3 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer"
          >
            Create {isGuardTarget ? 'Guard' : 'Client'} Account
          </button>
          <Link
            href={isGuardTarget ? '/client/dashboard' : '/guard/dashboard'}
            className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-medium transition-all whitespace-nowrap text-center cursor-pointer"
          >
            Back to {isGuardTarget ? 'Client' : 'Guard'} Dashboard
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          You can have both a client and guard account using the same email.
        </p>
      </div>
    </div>
  );
}