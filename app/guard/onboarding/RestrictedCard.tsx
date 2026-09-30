'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setGuardWizardEditFlag } from '@/lib/guard-wizard-edit';

export default function RestrictedCard({ status }: { status: string | null }) {
  const router = useRouter();
  const isExpired = status === 'expired';

  const updateLicence = () => {
    setGuardWizardEditFlag();
    router.push('/guard/complete-profile-wizard?edit=1&step=3');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#111d35] border border-[#1e2d4d] rounded-3xl p-7 text-center shadow-xl shadow-black/20">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-amber-500/15">
        <i className="ri-error-warning-line text-3xl text-amber-400 w-8 h-8 flex items-center justify-center"></i>
      </div>
      <h1 className="text-lg font-bold text-white mb-2">
        {isExpired ? 'Your SIA licence has expired' : 'Your account is on hold'}
      </h1>
      <p className="text-sm text-slate-400 mb-6">
        {isExpired
          ? 'Upload your renewed licence so we can verify it and reactivate your account.'
          : 'Your account has been temporarily paused. Please contact support for more information.'}
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