'use client';

import { useRouter } from 'next/navigation';
import { clearBadStoredRedirects } from '@/lib/safe-redirect';
import StatusCard from './StatusCard';

export default function ApprovedCard() {
  const router = useRouter();

  const goToDashboard = () => {
    clearBadStoredRedirects();
    router.push('/guard/dashboard');
  };

  return (
    <StatusCard icon="ri-shield-check-line" tone="green" title="Your SIA licence is verified ✓">
      <p className="text-sm text-slate-400 mb-6">Your account is active. You can now browse and apply for jobs near you.</p>
      <button
        onClick={goToDashboard}
        className="w-full px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
      >
        <i className="ri-dashboard-line w-5 h-5 flex items-center justify-center"></i>
        Go to my dashboard
      </button>
    </StatusCard>
  );
}