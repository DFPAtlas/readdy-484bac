'use client';

import { GuardVerification } from './types';
import VerificationSection from './VerificationSection';
import AvailabilitySection from './AvailabilitySection';

interface AvailabilityTabProps {
  guard: GuardVerification;
  checked: boolean;
  onToggle: () => void;
}

export default function AvailabilityTab({ guard, checked, onToggle }: AvailabilityTabProps) {
  return (
    <div className="space-y-4">
      <VerificationSection
        icon="ri-calendar-check-line"
        iconColor="bg-emerald-500/10"
        iconTextColor="text-emerald-400"
        title="Availability"
        description="Working schedule"
        checked={checked}
        onToggle={onToggle}
      >
        <AvailabilitySection guard={guard} />
      </VerificationSection>
    </div>
  );
}