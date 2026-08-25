'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-300 text-sm">Redirecting to admin login...</p>
      </div>
    </div>
  );
}