'use client';

import { GuardVerification } from './types';

interface ProfessionalDetailsSectionProps {
  guard: GuardVerification;
}

export default function ProfessionalDetailsSection({ guard }: ProfessionalDetailsSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="text-slate-400">Years of Experience:</span>
          <p className="font-medium text-slate-200">{guard.years_experience ?? 'Not provided'} {guard.years_experience != null ? 'years' : ''}</p>
        </div>
        <div>
          <span className="text-slate-400">Hourly Rate:</span>
          <p className="font-medium text-slate-200">{guard.hourly_rate ? `£${guard.hourly_rate}/hour` : 'Not provided'}</p>
        </div>
      </div>
      {guard.certifications && guard.certifications.length > 0 && (
        <div>
          <span className="text-slate-400 text-sm">Certifications:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {guard.certifications.map(cert => (
              <span key={cert} className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium">
                {cert.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            ))}
          </div>
        </div>
      )}
      {guard.bio && (
        <div className="mt-4">
          <span className="text-slate-400 text-sm">Bio:</span>
          <p className="text-slate-200 mt-1">{guard.bio}</p>
        </div>
      )}
    </>
  );
}