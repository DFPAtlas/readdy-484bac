'use client';

import { GuardVerification } from './types';
import VerificationSection from './VerificationSection';
import PersonalInfoSection from './PersonalInfoSection';
import SIALicenseSection from './SIALicenseSection';
import ProfessionalDetailsSection from './ProfessionalDetailsSection';
import AvailabilitySection from './AvailabilitySection';
import ProfileCompletenessSection from './ProfileCompletenessSection';

interface OverviewTabProps {
  guard: GuardVerification;
  checks: Record<string, boolean>;
  hasLicenceImages: boolean;
  onToggle: (section: string) => void;
  onViewLicence: () => void;
}

interface SectionConfig {
  key: string;
  icon: string;
  iconColor: string;
  iconTextColor: string;
  title: string;
  description: string;
  Component: React.FC<any>;
  componentProps?: Record<string, any>;
}

export default function OverviewTab({ guard, checks, hasLicenceImages, onToggle, onViewLicence }: OverviewTabProps) {
  const sections: SectionConfig[] = [
    {
      key: 'personal_info',
      icon: 'ri-user-line',
      iconColor: 'bg-blue-500/10',
      iconTextColor: 'text-blue-400',
      title: 'Personal Information',
      description: 'Basic identity details',
      Component: PersonalInfoSection,
      componentProps: { guard },
    },
    {
      key: 'sia_license',
      icon: 'ri-shield-check-line',
      iconColor: 'bg-purple-500/10',
      iconTextColor: 'text-purple-400',
      title: 'SIA License',
      description: 'Security license verification',
      Component: SIALicenseSection,
      componentProps: { guard, hasLicenceImages, onViewLicence },
    },
    {
      key: 'professional_details',
      icon: 'ri-briefcase-line',
      iconColor: 'bg-indigo-500/10',
      iconTextColor: 'text-indigo-400',
      title: 'Professional Details',
      description: 'Experience and qualifications',
      Component: ProfessionalDetailsSection,
      componentProps: { guard },
    },
    {
      key: 'availability',
      icon: 'ri-calendar-check-line',
      iconColor: 'bg-emerald-500/10',
      iconTextColor: 'text-emerald-400',
      title: 'Availability',
      description: 'Working schedule',
      Component: AvailabilitySection,
      componentProps: { guard },
    },
    {
      key: 'subscription',
      icon: 'ri-bank-card-line',
      iconColor: 'bg-amber-500/10',
      iconTextColor: 'text-amber-400',
      title: 'Profile Completeness',
      description: 'Confirm all required fields are filled',
      Component: ProfileCompletenessSection,
      componentProps: { guard },
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <VerificationSection
          key={section.key}
          icon={section.icon}
          iconColor={section.iconColor}
          iconTextColor={section.iconTextColor}
          title={section.title}
          description={section.description}
          checked={checks[section.key]}
          onToggle={() => onToggle(section.key)}
        >
          <section.Component {...section.componentProps} />
        </VerificationSection>
      ))}
    </div>
  );
}