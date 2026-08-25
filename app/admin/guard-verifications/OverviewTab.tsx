import { GuardVerification } from './types';
import VerificationSection from './VerificationSection';
import PersonalInfoSection from './PersonalInfoSection';
import SIALicenseSection from './SIALicenseSection';
import ProfessionalDetailsSection from './ProfessionalDetailsSection';
import AvailabilitySection from './AvailabilitySection';

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

function SubscriptionSummary({ guard }: { guard: GuardVerification }) {
  const hasSubscription = !!(guard.plan_name || guard.subscription_plan || guard.subscription_status);
  const isActive = guard.subscription_status === 'active';
  const isTrialing = guard.subscription_status === 'trialing';

  return (
    <div className="space-y-3">
      {hasSubscription ? (
        <>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isActive ? 'bg-emerald-500/15' : isTrialing ? 'bg-blue-500/15' : 'bg-amber-500/15'
            }`}>
              <i className={`text-lg ${
                isActive ? 'ri-vip-crown-fill text-emerald-400' :
                isTrialing ? 'ri-timer-flash-fill text-blue-400' :
                'ri-vip-crown-line text-amber-400'
              } w-5 h-5 flex items-center justify-center`}></i>
            </div>
            <div>
              <p className="text-white font-semibold">{guard.plan_name || guard.subscription_plan || 'Unknown Plan'}</p>
              <p className="text-xs text-slate-400">
                {guard.subscription_status === 'active' ? 'Active subscription' :
                 guard.subscription_status === 'trialing' ? 'Free trial in progress' :
                 guard.subscription_status === 'past_due' ? 'Payment past due' :
                 guard.subscription_status || 'No active subscription'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-xs text-slate-500 mb-0.5">Plan</p>
              <p className="font-medium text-slate-200">{guard.plan_name || '—'}</p>
            </div>
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-xs text-slate-500 mb-0.5">Slug</p>
              <p className="font-medium text-slate-200">{guard.plan_slug || '—'}</p>
            </div>
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-xs text-slate-500 mb-0.5">Subscription Plan</p>
              <p className="font-medium text-slate-200">{guard.subscription_plan || '—'}</p>
            </div>
            <div className="bg-[#111d35] rounded-lg p-3 border border-[#1a2b4a]">
              <p className="text-xs text-slate-500 mb-0.5">Promo Tier</p>
              <p className="font-medium text-slate-200">{guard.promo_tier || '—'}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-500/10 flex items-center justify-center mb-2">
            <i className="ri-vip-crown-line text-slate-500 text-lg w-5 h-5 flex items-center justify-center"></i>
          </div>
          <p className="text-slate-400 text-sm">No subscription on file</p>
          <p className="text-slate-500 text-xs mt-0.5">This guard may be on a free tier or hasn't chosen a plan yet</p>
        </div>
      )}
    </div>
  );
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
      icon: 'ri-vip-crown-line',
      iconColor: 'bg-amber-500/10',
      iconTextColor: 'text-amber-400',
      title: 'Subscription',
      description: 'Plan and billing status',
      Component: SubscriptionSummary,
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