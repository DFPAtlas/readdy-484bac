'use client';

import Link from 'next/link';

interface CompleteProfileNudgeProps {
  guard: {
    profile_image_url?: string | null;
    bio?: string | null;
    full_name?: string;
  } | null;
}

export default function CompleteProfileNudge({ guard }: CompleteProfileNudgeProps) {
  if (!guard) return null;

  const missingPhoto = !guard.profile_image_url?.trim();
  const missingBio = !guard.bio?.trim();

  if (!missingPhoto && !missingBio) return null;

  const items: string[] = [];
  if (missingPhoto) items.push('profile photo');
  if (missingBio) items.push('bio');

  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-user-smile-line text-xl sm:text-2xl text-blue-400"></i>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-blue-300 mb-1">
                Complete your profile to stand out
              </h3>
              <p className="text-xs sm:text-sm text-blue-400/80">
                You&apos;re missing a{items.length === 1 ? ' ' : ' '}{items.join(' and ')}.
                Guards with complete profiles get 3x more job offers — it only takes a minute.
              </p>
            </div>
          </div>
          <Link
            href="/guard/profile"
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-500/20 text-blue-400 rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-500/30 transition-colors whitespace-nowrap self-start sm:self-auto flex items-center gap-2"
          >
            <i className="ri-pencil-line"></i>
            Complete Profile
          </Link>
        </div>
      </div>
    </div>
  );
}