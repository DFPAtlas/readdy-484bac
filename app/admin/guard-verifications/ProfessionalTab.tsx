'use client';

import { GuardVerification } from './types';
import VerificationSection from './VerificationSection';
import ProfessionalDetailsSection from './ProfessionalDetailsSection';

interface ProfessionalTabProps {
  guard: GuardVerification;
  checked: boolean;
  onToggle: () => void;
}

export default function ProfessionalTab({ guard, checked, onToggle }: ProfessionalTabProps) {
  return (
    <div className="space-y-4">
      <VerificationSection
        icon="ri-briefcase-line"
        iconColor="bg-indigo-500/10"
        iconTextColor="text-indigo-400"
        title="Professional Details"
        description="Experience and qualifications"
        checked={checked}
        onToggle={onToggle}
      >
        <ProfessionalDetailsSection guard={guard} />
      </VerificationSection>
    </div>
  );
}