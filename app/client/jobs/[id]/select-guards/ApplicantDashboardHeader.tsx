"use client";

import Link from "next/link";

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  status: string;
  hourly_rate: number;
  sia_licence_required: boolean;
}

interface Props {
  job: Job;
  applicantCount: number;
  selectedCount: number;
  shortlistedCount: number;
}

export default function ApplicantDashboardHeader({
  job,
  applicantCount,
  selectedCount,
  shortlistedCount,
}: Props) {
  const dateStr = new Date(job.start_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const endStr = job.end_date
    ? new Date(job.end_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <Link
              href={`/client/jobs/${job.id}`}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer flex-shrink-0 mt-1"
            >
              <i className="ri-arrow-left-line text-slate-400 text-base"></i>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white mb-1">
                {job.job_title}
              </h1>
              <p className="text-sm text-slate-500">
                {job.venue_name}, {job.venue_city}
                {job.venue_postcode && ` ${job.venue_postcode}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#162036] text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#1e2d4d]">
              £{job.hourly_rate}/hr
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                job.status === "awaiting_guard_selection"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                  : job.status === "open"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/25"
              }`}
            >
              {job.status === "awaiting_guard_selection"
                ? "Awaiting Selection"
                : job.status === "open"
                ? "Open"
                : job.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Shift Date</p>
            <p className="text-sm font-medium text-slate-200">
              {dateStr}
              {endStr && ` — ${endStr}`}
            </p>
          </div>
          <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Time</p>
            <p className="text-sm font-medium text-slate-200">
              {job.start_time.slice(0, 5)} — {job.end_time.slice(0, 5)}
            </p>
          </div>
          <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Guards Required</p>
            <p className="text-sm font-medium text-slate-200">
              {job.number_of_guards}
            </p>
          </div>
          <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Applicants</p>
            <p className="text-sm font-medium text-teal-400">
              {applicantCount} applied
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[#1e2d4d]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Selected:</span>
            <span className="text-sm font-semibold text-teal-400">
              {selectedCount} / {job.number_of_guards}
            </span>
          </div>
          <div className="h-4 w-px bg-[#1e2d4d] hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Shortlisted:</span>
            <span className="text-sm font-semibold text-amber-400">
              {shortlistedCount}
            </span>
          </div>
          <div className="h-4 w-px bg-[#1e2d4d] hidden md:block"></div>
          {job.sia_licence_required && (
            <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-xs font-medium border border-amber-500/25">
              <i className="ri-shield-check-line mr-1"></i>SIA Required
            </span>
          )}
        </div>
      </div>
    </div>
  );
}