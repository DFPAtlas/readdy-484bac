'use client';

import GuardCard from './GuardCard';
import { GuardVerification } from './types';

interface GuardCardGridProps {
  guards: GuardVerification[];
  onReview: (guard: GuardVerification) => void;
  onRequestInfo: (guard: GuardVerification) => void;
}

export default function GuardCardGrid({ guards, onReview, onRequestInfo }: GuardCardGridProps) {
  return (
    <ul aria-label="Guard applications" className="grid grid-cols-1 gap-4 bg-[#0a1628]/40 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {guards.map(guard => (
        <li key={guard.id} className="min-w-0">
          <GuardCard guard={guard} onReview={() => onReview(guard)} onRequestInfo={() => onRequestInfo(guard)} />
        </li>
      ))}
    </ul>
  );
}
