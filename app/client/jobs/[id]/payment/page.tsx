import { Suspense } from 'react';
import PaymentClient from './PaymentClient';

export async function generateStaticParams() {
  // Keep the existing static-export shells. Private job IDs are loaded only
  // after authentication by the client page, never by an anonymous build.
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading payment details...</p>
          </div>
        </div>
      }
    >
      <PaymentClient jobId={id} />
    </Suspense>
  );
}