'use client';

import { GuardVerification, calculateAge } from './types';

interface PersonalInfoSectionProps {
  guard: GuardVerification;
}

export default function PersonalInfoSection({ guard }: PersonalInfoSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-slate-400">Full Name:</span>
        <p className="font-medium text-slate-200">{guard.full_name}</p>
      </div>
      <div>
        <span className="text-slate-400">Email:</span>
        <p className="font-medium text-slate-200">{guard.email}</p>
      </div>
      <div>
        <span className="text-slate-400">Phone:</span>
        <p className="font-medium text-slate-200">{guard.phone || 'Not provided'}</p>
      </div>
      <div>
        <span className="text-slate-400">Date of Birth:</span>
        <p className="font-medium text-slate-200">
          {guard.date_of_birth
            ? `${new Date(guard.date_of_birth).toLocaleDateString()} (${calculateAge(guard.date_of_birth)} years old)`
            : 'Not provided'}
        </p>
      </div>
      <div>
        <span className="text-slate-400">City:</span>
        <p className="font-medium text-slate-200">{guard.city || 'Not provided'}</p>
      </div>
      <div>
        <span className="text-slate-400">Postcode:</span>
        <p className="font-medium text-slate-200">{guard.postcode || 'Not provided'}</p>
      </div>
      <div className="col-span-2">
        <span className="text-slate-400">Location:</span>
        <p className="font-medium text-slate-200">{guard.location || 'Not provided'}</p>
      </div>
    </div>
  );
}