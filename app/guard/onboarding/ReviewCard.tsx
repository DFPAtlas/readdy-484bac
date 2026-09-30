'use client';

import StatusCard from './StatusCard';

export default function ReviewCard() {
  return (
    <StatusCard icon="ri-time-line" tone="amber" title="Our team is reviewing your licence.">
      <p className="text-sm text-slate-400">
        We&apos;ll email you within 1 working day with the outcome.
      </p>
    </StatusCard>
  );
}