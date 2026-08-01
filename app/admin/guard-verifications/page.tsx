
import { Suspense } from 'react';
import GuardVerificationsClient from './GuardVerificationsClient';

export default function GuardVerificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <GuardVerificationsClient />
    </Suspense>
  );
}
