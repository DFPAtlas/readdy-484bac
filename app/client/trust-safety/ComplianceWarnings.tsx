'use client';

import { useState } from 'react';

interface JobWithSafety {
  id: string;
  job_title: string;
  venue_name: string;
  status: string;
  start_date: string;
  risk_level: string | null;
  lone_worker_flag: boolean;
  sia_licence_required: boolean;
  required_license_type: string | null;
  assigned_count: number;
  number_of_guards: number;
  payment_status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  site_access_instructions: string | null;
  parking_instructions: string | null;
  safety_check?: {
    id: string;
    site_address_confirmed: boolean;
    site_contact_available: boolean;
    emergency_contact_added: boolean;
    site_access_instructions_added: boolean;
    risk_notes_added: boolean;
    lone_worker_flagged: boolean;
    parking_details_added: boolean;
    required_sia_selected: boolean;
  };
}

interface GuardAssignment {
  id: string;
  guard_id: string;
  status: string;
  guards: {
    id: string;
    full_name: string;
    sia_licence_number: string | null;
    sia_verified: boolean;
    sia_expiry_date: string | null;
    sia_licence_type: string | null;
  } | null;
}

interface ComplianceWarningsProps {
  jobs: JobWithSafety[];
  assignments: Record<string, GuardAssignment[]>;
}

interface Warning {
  id: string;
  jobId: string;
  jobTitle: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
}

export default function ComplianceWarnings({ jobs, assignments }: ComplianceWarningsProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [expanded, setExpanded] = useState(true);

  const warnings: Warning[] = [];
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  jobs.forEach((job) => {
    const isSoon = job.start_date && new Date(job.start_date) <= in48h && new Date(job.start_date) >= now;
    const sc = job.safety_check || {};
    const jobAssignments = assignments[job.id] || [];

    if (!job.safety_check) {
      warnings.push({
        id: `${job.id}-no-safety-check`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'Safety Checklist Not Started',
        message: isSoon
          ? 'This job starts soon and no safety checklist has been completed.'
          : 'Complete the safety checklist before the job starts.',
        icon: 'ri-shield-line',
      });
    }

    if (job.sia_licence_required && !sc.required_sia_selected) {
      warnings.push({
        id: `${job.id}-sia`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'SIA Licence Requirement Not Confirmed',
        message: `This job requires SIA licence type "${job.required_license_type || 'specific'}". Please confirm the required licence type is selected.`,
        icon: 'ri-shield-check-line',
      });
    }

    if (job.lone_worker_flag && !sc.lone_worker_flagged) {
      warnings.push({
        id: `${job.id}-lone-worker`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: 'warning',
        title: 'Lone Worker Not Flagged',
        message: 'This job has lone worker risk but the checklist has not been flagged.',
        icon: 'ri-user-location-line',
      });
    }

    if (!job.emergency_contact_name && !job.emergency_contact_phone) {
      warnings.push({
        id: `${job.id}-emergency`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'No Emergency Contact',
        message: 'Add an emergency contact for this job so guards know who to call in an emergency.',
        icon: 'ri-phone-line',
      });
    }

    if (!job.site_access_instructions && !job.parking_instructions) {
      warnings.push({
        id: `${job.id}-site-info`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: 'warning',
        title: 'Missing Site Instructions',
        message: 'Guards need access and parking instructions. Add them in Site Instructions.',
        icon: 'ri-door-open-line',
      });
    }

    jobAssignments.forEach((a) => {
      const g = a.guards;
      if (!g) return;
      if (!g.sia_verified) {
        warnings.push({
          id: `${job.id}-guard-${g.id}-unverified`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'warning',
          title: `Guard Not Verified: ${g.full_name}`,
          message: 'This guard has not completed SIA verification.',
          icon: 'ri-user-unfollow-line',
        });
      }
      if (g.sia_expiry_date) {
        const expiry = new Date(g.sia_expiry_date);
        const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (expiry < now) {
          warnings.push({
            id: `${job.id}-guard-${g.id}-expired`,
            jobId: job.id,
            jobTitle: job.job_title,
            type: 'critical',
            title: `SIA Expired: ${g.full_name}`,
            message: `This guard's SIA licence expired on ${expiry.toLocaleDateString('en-GB')}.`,
            icon: 'ri-shield-flash-line',
          });
        } else if (expiry <= in30d) {
          warnings.push({
            id: `${job.id}-guard-${g.id}-expiring`,
            jobId: job.id,
            jobTitle: job.job_title,
            type: 'warning',
            title: `SIA Expiring Soon: ${g.full_name}`,
            message: `This guard's SIA licence expires on ${expiry.toLocaleDateString('en-GB')}.`,
            icon: 'ri-time-line',
          });
        }
      }
      if (job.sia_licence_required && job.required_license_type && g.sia_licence_type !== job.required_license_type) {
        warnings.push({
          id: `${job.id}-guard-${g.id}-licence-mismatch`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'warning',
          title: `Licence Type Mismatch: ${g.full_name}`,
          message: `Job requires "${job.required_license_type}" but guard has "${g.sia_licence_type || 'none'}".`,
          icon: 'ri-shield-keyhole-line',
        });
      }
    });

    if (job.status === 'awaiting_payment' || job.payment_status === 'pending') {
      warnings.push({
        id: `${job.id}-payment`,
        jobId: job.id,
        jobTitle: job.job_title,
        type: isSoon ? 'critical' : 'warning',
        title: 'Payment Not Complete',
        message: 'This job requires payment before guards can be confirmed.',
        icon: 'ri-wallet-3-line',
      });
    }

    if (isSoon && warnings.some((w) => w.jobId === job.id && (w.type === 'critical' || w.type === 'warning'))) {
      const existing = warnings.find((w) => w.id === `${job.id}-starting-soon`);
      if (!existing) {
        warnings.push({
          id: `${job.id}-starting-soon`,
          jobId: job.id,
          jobTitle: job.job_title,
          type: 'critical',
          title: 'Job Starting Soon with Unresolved Issues',
          message: `This job starts on ${new Date(job.start_date).toLocaleDateString('en-GB')} and has outstanding safety or compliance warnings.`,
          icon: 'ri-alarm-warning-line',
        });
      }
    }
  });

  const filtered = filter === 'all' ? warnings : warnings.filter((w) => w.type === filter);

  if (warnings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i className="ri-check-double-line text-2xl text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">All Clear</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No compliance or safety warnings found across your jobs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border uppercase tracking-wide cursor-pointer transition-all ${
                filter === f
                  ? f === 'critical'
                    ? 'bg-red-500 text-white border-red-500'
                    : f === 'warning'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : f === 'info'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-teal-500 text-white border-teal-500'
                  : 'bg-white dark:bg-[#111d35] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e2d4d]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.map((w) => {
        const color = w.type === 'critical'
          ? 'bg-red-500/5 border-red-500/20 text-red-500'
          : w.type === 'warning'
          ? 'bg-amber-500/5 border-amber-500/20 text-amber-500'
          : 'bg-blue-500/5 border-blue-500/20 text-blue-500';
        const iconColor = w.type === 'critical'
          ? 'text-red-400'
          : w.type === 'warning'
          ? 'text-amber-400'
          : 'text-blue-400';

        return (
          <div
            key={w.id}
            className={`rounded-xl border p-4 ${color}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <i className={`${w.icon} ${iconColor} text-lg`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold">{w.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${
                    w.type === 'critical'
                      ? 'bg-red-500 text-white border-red-500'
                      : w.type === 'warning'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-500 text-white border-blue-500'
                  }`}>
                    {w.type}
                  </span>
                </div>
                <p className="text-xs opacity-80 mb-1">{w.message}</p>
                <p className="text-[10px] opacity-60 font-medium">{w.jobTitle}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}