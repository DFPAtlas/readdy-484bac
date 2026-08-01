'use client';

import Link from 'next/link';
import { Guard } from './types';

interface Props {
  guard: Guard | null;
}

function getProfileCompletion(guard: Guard | null) {
  if (!guard) return 0;
  let score = 0;
  if (guard.full_name) score += 15;
  if (guard.email) score += 15;
  if (guard.profile_image_url) score += 15;
  if (guard.location) score += 15;
  if (guard.postcode) score += 15;
  if (guard.years_experience !== null) score += 15;
  if (guard.sia_licence_front_url) score += 10;
  return score;
}

function getSIAStatus(guard: Guard | null) {
  if (!guard?.sia_licence_front_url) return { label: 'Missing', pct: 0, color: 'red' as const };
  if (guard?.sia_expiry_date) {
    const totalDays = 365 * 3;
    const daysLeft = Math.floor((new Date(guard.sia_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', pct: 0, color: 'red' as const };
    const pct = Math.min(100, Math.round((daysLeft / totalDays) * 100));
    if (daysLeft <= 60) return { label: `${daysLeft}d left`, pct, color: 'amber' as const };
    return { label: 'Valid', pct, color: 'emerald' as const };
  }
  return { label: 'Uploaded', pct: 60, color: 'emerald' as const };
}

const colorMap = {
  emerald: { track: 'bg-emerald-400', text: 'text-emerald-400' },
  amber: { track: 'bg-amber-400', text: 'text-amber-400' },
  red: { track: 'bg-red-400', text: 'text-red-400' },
};

export default function CompliancePanel({ guard }: Props) {
  const completion = getProfileCompletion(guard);
  const sia = getSIAStatus(guard);

  const docsUploaded = guard?.sia_licence_front_url ? 1 : 0;
  const docsTotal = 1;
  const docsPct = Math.round((docsUploaded / docsTotal) * 100);

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-shield-check-line text-teal-400"></i>
        </div>
        Compliance
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">SIA Licence</span>
            <span className={`text-xs font-semibold ${colorMap[sia.color].text}`}>{sia.label}</span>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colorMap[sia.color].track} transition-all duration-500`} style={{ width: `${sia.pct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Profile Completeness</span>
            <span className={`text-xs font-semibold ${completion >= 80 ? 'text-emerald-400' : completion >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{completion}%</span>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${completion >= 80 ? 'bg-emerald-400' : completion >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${completion}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Documents</span>
            <span className={`text-xs font-semibold ${docsPct >= 80 ? 'text-emerald-400' : docsPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{docsUploaded}/{docsTotal}</span>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${docsPct >= 80 ? 'bg-emerald-400' : docsPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${docsPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Background Check</span>
            <span className={`text-xs font-semibold ${guard?.verification_status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {guard?.verification_status === 'approved' ? 'Complete' : 'Pending'}
            </span>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${guard?.verification_status === 'approved' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: guard?.verification_status === 'approved' ? '100%' : '40%' }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-[#1a2b4a]">
        <Link href="/guard/profile" className="flex-1 text-center px-3 py-2.5 bg-[#0B1933] border border-[#1a2b4a] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] hover:border-[#2a3e5f] transition-all whitespace-nowrap cursor-pointer">
          Update Profile
        </Link>
        <Link href="/guard/bank-settings" className="flex-1 text-center px-3 py-2.5 bg-[#0B1933] border border-[#1a2b4a] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] hover:border-[#2a3e5f] transition-all whitespace-nowrap cursor-pointer">
          Bank Details
        </Link>
      </div>
    </div>
  );
}