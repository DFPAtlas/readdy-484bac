import ChecklistProgress from './ChecklistProgress';
import { GuardVerification, getMissingProfileItems } from './types';

interface IncompleteGuardCardProps {
  guard: GuardVerification;
}

export default function IncompleteGuardCard({ guard }: IncompleteGuardCardProps) {
  const missing = getMissingProfileItems(guard);
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
  ];

  return (
    <div className="bg-[#111d35] rounded-xl border-2 border-amber-500/30 p-6">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a2b4a] flex-shrink-0">
          {guard.profile_image_url ? (
            <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-500/10">
              <i className="ri-user-line text-2xl text-amber-400 w-6 h-6 flex items-center justify-center"></i>
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-white">{guard.full_name}</h3>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Profile Incomplete
            </span>
          </div>
          <div className="space-y-1 text-sm text-slate-400 mb-3">
            <p className="flex items-center gap-2">
              <i className="ri-mail-line w-4 h-4 flex items-center justify-center"></i>
              {guard.email}
            </p>
            <p className="flex items-center gap-2">
              <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
              Registered: {new Date(guard.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="mb-3">
            <ChecklistProgress
              title="Profile completion"
              items={profileItems}
              color="amber"
              bare={true}
            />
          </div>

          {missing.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400">Still needed:</p>
              <div className="flex flex-wrap gap-2">
                {missing.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30"
                  >
                    <i className="ri-close-circle-line text-red-400 w-3 h-3 flex items-center justify-center"></i>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 mt-3">
            <i className="ri-information-line text-amber-400 text-base mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
            <p className="text-sm text-amber-400/80">
              This guard has not finished setting up their profile. No action required until they complete it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}