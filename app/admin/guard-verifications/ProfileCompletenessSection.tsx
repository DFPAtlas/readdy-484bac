'use client';

import { GuardVerification, getMissingProfileItems } from './types';
import ChecklistProgress from './ChecklistProgress';

interface ProfileCompletenessSectionProps {
  guard?: GuardVerification;
}

export default function ProfileCompletenessSection({ guard }: ProfileCompletenessSectionProps) {
  if (!guard) {
    return (
      <div className="text-sm">
        <span className="text-slate-400">Profile Status:</span>
        <p className="font-medium text-slate-500 mt-1">No guard data available</p>
      </div>
    );
  }

  const profileItems = [
    { label: 'Full name', checked: !!guard.full_name?.trim() },
    { label: 'Phone number', checked: !!guard.phone?.trim() },
    { label: 'Date of birth', checked: !!guard.date_of_birth },
    { label: 'SIA licence number', checked: !!guard.sia_licence_number?.trim() },
    { label: 'Licence cardholder name', checked: !!guard.license_cardholder_name?.trim() },
    { label: 'SIA expiry date', checked: !!guard.sia_expiry_date },
    { label: 'Years of experience', checked: guard.years_experience != null && guard.years_experience !== 0 },
    { label: 'Hourly rate', checked: !!guard.hourly_rate },
    { label: 'Certifications', checked: !!guard.certifications && guard.certifications.length > 0 },
    { label: 'Available days', checked: !!guard.available_days && guard.available_days.length > 0 },
    { label: 'Working hours', checked: !!guard.available_hours_from && !!guard.available_hours_to },
    { label: 'Bio / About', checked: !!guard.bio?.trim() },
    { label: 'Profile photo', checked: !!guard.profile_image_url?.trim() },
    { label: 'SIA licence front image', checked: !!guard.sia_licence_front_url?.trim() },
    { label: 'SIA licence back image', checked: !!guard.sia_licence_back_url?.trim() },
    { label: 'Driving licence front', checked: !!guard.driving_licence_front_url?.trim() },
    { label: 'Driving licence back', checked: !!guard.driving_licence_back_url?.trim() },
    { label: 'Proof of address', checked: !!guard.proof_of_address_url?.trim() },
  ];

  const completed = profileItems.filter(i => i.checked).length;
  const total = profileItems.length;
  const missing = getMissingProfileItems(guard);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Profile Status:</span>
        <span className={`text-sm font-semibold ${completed === total ? 'text-emerald-400' : 'text-amber-400'}`}>
          {completed === total ? '✓ Complete' : `${completed}/${total} fields filled`}
        </span>
      </div>

      <ChecklistProgress
        title="Profile completion"
        items={profileItems}
        color={completed === total ? 'green' : 'amber'}
        bare={true}
      />

      {missing.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Missing fields:</p>
          <div className="flex flex-wrap gap-2">
            {missing.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30"
              >
                <i className="ri-close-circle-line text-red-400 w-3 h-3 flex items-center justify-center"></i>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {guard.profile_completed && (
        <p className="text-xs text-emerald-400 font-medium">
          <i className="ri-check-line mr-1"></i>
          Guard has marked their profile as complete
        </p>
      )}
    </div>
  );
}