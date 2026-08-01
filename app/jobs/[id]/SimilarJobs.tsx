'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface SimilarJob {
  id: string;
  job_title: string;
  security_type: string;
  venue_name: string;
  venue_city: string;
  hourly_rate: number;
  start_date: string;
  start_time: string;
  end_time: string;
  urgency: string;
  sia_licence_required: boolean;
  number_of_guards: number;
  created_at: string;
}

interface SimilarJobsProps {
  currentJobId: string;
  securityType: string;
  venueCity: string;
}

export default function SimilarJobs({ currentJobId, securityType, venueCity }: SimilarJobsProps) {
  const [jobs, setJobs] = useState<SimilarJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const fetchSimilarJobs = async () => {
      if (cancelled) return;
      try {
        const { data: byTypeAndCity } = await supabase
          .from('jobs')
          .select('id, job_title, security_type, venue_name, venue_city, hourly_rate, start_date, start_time, end_time, urgency, sia_licence_required, number_of_guards, created_at')
          .neq('id', currentJobId)
          .eq('status', 'open')
          .eq('is_deleted', false)
          .eq('security_type', securityType)
          .eq('venue_city', venueCity)
          .order('created_at', { ascending: false })
          .limit(4);
        if (cancelled) return;

        if (byTypeAndCity && byTypeAndCity.length >= 3) {
          setJobs(byTypeAndCity.slice(0, 4));
          setLoading(false);
          return;
        }

        const { data: byType } = await supabase
          .from('jobs')
          .select('id, job_title, security_type, venue_name, venue_city, hourly_rate, start_date, start_time, end_time, urgency, sia_licence_required, number_of_guards, created_at')
          .neq('id', currentJobId)
          .eq('status', 'open')
          .eq('is_deleted', false)
          .eq('security_type', securityType)
          .order('created_at', { ascending: false })
          .limit(4);
        if (cancelled) return;

        const combined = byType || [];
        const existing = new Set(combined.map((j) => j.id));

        if (combined.length < 4) {
          const { data: byCity } = await supabase
            .from('jobs')
            .select('id, job_title, security_type, venue_name, venue_city, hourly_rate, start_date, start_time, end_time, urgency, sia_licence_required, number_of_guards, created_at')
            .neq('id', currentJobId)
            .eq('status', 'open')
            .eq('is_deleted', false)
            .eq('venue_city', venueCity)
            .order('created_at', { ascending: false })
            .limit(4);
          if (cancelled) return;

          (byCity || []).forEach((j) => {
            if (!existing.has(j.id)) {
              combined.push(j);
              existing.add(j.id);
            }
          });
        }

        if (!cancelled) setJobs(combined.slice(0, 4));
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching similar jobs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSimilarJobs();
    return () => { cancelled = true; };
  }, [currentJobId, securityType, venueCity]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate': return 'bg-red-500/15 text-red-400 border border-red-500/30';
      case 'urgent': return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
      default: return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    }
  };

  const calcHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let h = eh - sh;
    let m = em - sm;
    if (m < 0) { h -= 1; m += 60; }
    if (h < 0) h += 24;
    return (h + m / 60).toFixed(1);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="h-6 w-48 bg-slate-700 rounded animate-pulse mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111d35] rounded-xl border border-slate-700/50 p-5 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-700 rounded w-2/3 mb-4"></div>
              <div className="h-8 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center border border-teal-400/20">
            <i className="ri-briefcase-4-line text-teal-400 text-lg"></i>
          </div>
          <h2 className="text-2xl font-bold text-white">Similar Jobs</h2>
          <span className="bg-teal-500/10 text-teal-400 text-sm font-medium px-3 py-1 rounded-full">
            {jobs.length} found
          </span>
        </div>
        <Link
          href="/jobs"
          className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors whitespace-nowrap"
        >
          Browse all jobs
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {jobs.map((job) => {
          const hours = calcHours(job.start_time, job.end_time);
          const estPay = (parseFloat(hours) * job.hourly_rate).toFixed(0);
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="group bg-[#111d35] rounded-xl border border-slate-700/50 p-5 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-200 flex flex-col cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${getUrgencyColor(job.urgency)}`}>
                  {job.urgency.charAt(0).toUpperCase() + job.urgency.slice(1)}
                </span>
                <span className="text-xs text-slate-500">{timeAgo(job.created_at)}</span>
              </div>

              <h3 className="font-bold text-white text-sm leading-snug mb-1 group-hover:text-teal-400 transition-colors line-clamp-2">
                {job.job_title}
              </h3>

              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                <i className="ri-map-pin-line text-teal-500"></i>
                {job.venue_name}, {job.venue_city}
              </p>

              <div className="space-y-1.5 mb-4 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <i className="ri-calendar-line text-slate-500"></i>
                  {new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <i className="ri-time-line text-slate-500"></i>
                  {job.start_time} – {job.end_time} ({hours}hrs)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <i className="ri-shield-line text-slate-500"></i>
                  {job.security_type.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  {job.sia_licence_required && (
                    <span className="ml-1 bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded text-xs">SIA</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <i className="ri-group-line text-slate-500"></i>
                  {job.number_of_guards} guard{job.number_of_guards !== 1 ? 's' : ''} needed
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-teal-400">£{Number(job.hourly_rate).toFixed(2)}</span>
                  <span className="text-xs text-slate-500">/hr</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Est. </span>
                  <span className="text-sm font-semibold text-white">£{estPay}</span>
                </div>
              </div>

              <div className="mt-3 w-full bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-white py-2 rounded-lg text-xs font-semibold text-center transition-colors whitespace-nowrap">
                View Job
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}