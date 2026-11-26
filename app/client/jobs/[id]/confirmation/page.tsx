import { Suspense } from 'react';
import BookingConfirmationClient from './BookingConfirmationClient';

export async function generateStaticParams() {
  // Keep the existing static-export shells. Private job IDs are loaded only
  // after authentication by the client page, never by an anonymous build.
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading booking confirmation...</p>
        </div>
      </div>
    }>
      <BookingConfirmationClient jobId={id} />
    </Suspense>
  );
}