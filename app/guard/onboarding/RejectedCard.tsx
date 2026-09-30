'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setGuardWizardEditFlag } from '@/lib/guard-wizard-edit';

export default function RejectedCard({ reason }: { reason: string | null }) {
  const router = useRouter();

  const updateLicence = () => {
    setGuardWizardEditFlag();
    router.push('/guard/complete-profile-wizard?edit=1&step=3');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#111d35] border border-[#1e2d4d] rounded-3xl p-7 text-center shadow-xl shadow-black/20">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-red-500/15">
        <i className="ri-close-circle-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
      </div>
      <h1 className="text-lg font-bold text-white mb-2">We couldn&apos;t verify your SIA licence</h1>
      <p className="text-sm text-slate-400 mb-6">
        {reason || 'We couldn\u2019t verify your SIA licence against the register.'}
      </p>
      <button
        onClick={updateLicence}
        className="w-full px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
      >
        <i className="ri-edit-line w-5 h-5 flex items-center justify-center"></i>
        Update my licence details
      </button>
      <Link
        href="/contact"
        className="mt-3 inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#162236] border border-[#1e2d4d] text-slate-300 rounded-xl font-medium hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap cursor-pointer"
      >
        <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center"></i>
        Contact support
      </Link>
    </div>
  );
}