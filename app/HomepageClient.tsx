'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TrustBadges from './TrustBadges';

export default function HomepageClient() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const [jsEnabled, setJsEnabled] = useState(false);
  const [stats, setStats] = useState<{
    totalGuards: number | null;
    completedJobs: number | null;
    activeClients: number | null;
    successRate: number | null;
  }>({
    totalGuards: null,
    completedJobs: null,
    activeClients: null,
    successRate: null,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setJsEnabled(true);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({
              ...prev,
              [entry.target.id]: true,
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const [guardsRes, completedJobsRes, clientsRes, totalAssignmentsRes, completedAssignmentsRes] = await Promise.all([
          supabase.from('guards').select('id', { count: 'exact', head: true }),
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('job_assignments').select('id', { count: 'exact', head: true }),
          supabase.from('job_assignments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        ]);

        if (cancelled) return;

        const totalGuards = guardsRes.count ?? 0;
        const completedJobs = completedJobsRes.count ?? 0;
        const activeClients = clientsRes.count ?? 0;

        const totalAssignments = totalAssignmentsRes.count ?? 0;
        const completedAssignments = completedAssignmentsRes.count ?? 0;
        const successRate =
          totalAssignments > 0
            ? Math.round((completedAssignments / totalAssignments) * 100)
            : 0;

        setStats({
          totalGuards,
          completedJobs,
          activeClients,
          successRate: totalAssignments > 0 ? successRate : null,
        });
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  const MIN_STAT = 50;
  const statsReady = !loadingStats;
  const showGuards = statsReady && stats.totalGuards !== null && stats.totalGuards >= MIN_STAT;
  const showJobs = statsReady && stats.completedJobs !== null && stats.completedJobs >= MIN_STAT;
  const showClients = statsReady && stats.activeClients !== null && stats.activeClients >= MIN_STAT;
  const showSuccessRate = statsReady && stats.successRate !== null && stats.successRate >= MIN_STAT;
  const showStatsSection = statsReady && (showGuards || showJobs || showClients);

  return (
    <>
      <section className="py-20 bg-[#0B1933]" aria-labelledby="how-it-works-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div
            id="how-it-works"
            data-animate
            className={`text-center mb-16 transition-all duration-1000 ${
              jsEnabled && !isVisible['how-it-works'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-lightbulb-line" aria-hidden="true"></i>
              Simple Process
            </div>
            <h2 id="how-it-works-heading" className="text-4xl font-bold text-white mb-4">
              How QuickGuard Works
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              QuickGuard connects businesses and venues with SIA-licensed guards, booked by the shift. You can post a job in minutes, but cover is only in place once an eligible guard responds, you select them, and payment is complete.
            </p>
          </div>

          <ol className="grid md:grid-cols-3 gap-8 list-none p-0 m-0">
            <li
              id="step-1"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-200 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-1'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-user-add-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 1</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Post your job</h3>
              <p className="text-slate-400 leading-relaxed">
                Describe the site, dates, hours and duties. Posting is free and usually takes a few minutes.
              </p>
            </li>

            <li
              id="step-2"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-400 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-2'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-briefcase-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 2</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Eligible guards respond</h3>
              <p className="text-slate-400 leading-relaxed">
                Licensed guards who match your job can respond, subject to their own availability. A posted job does not guarantee cover.
              </p>
            </li>

            <li
              id="step-3"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-600 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-3'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-cpu-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 3</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Select your guard</h3>
              <p className="text-slate-400 leading-relaxed">
                Review responses, profiles and licence details, then choose the guard you want for the shift.
              </p>
            </li>

            <li
              id="step-4"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-200 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-4'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-bank-card-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 4</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Pay and confirm</h3>
              <p className="text-slate-400 leading-relaxed">
                Pay by card through Stripe. The booking is confirmed once payment is complete, and the funds are held until the work is done.
              </p>
            </li>

            <li
              id="step-5"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-400 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-5'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-calendar-check-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 5</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Shift and completion</h3>
              <p className="text-slate-400 leading-relaxed">
                The guard attends the shift. You confirm attendance and job completion from your dashboard.
              </p>
            </li>

            <li
              id="step-6"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 p-8 rounded-2xl text-center transition-all duration-1000 delay-600 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['step-6'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-6 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-star-line text-2xl text-teal-400"></i>
              </div>
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-teal-400 mb-3">Stage 6</span>
              <h3 className="text-xl font-semibold mb-4 text-white">Release and review</h3>
              <p className="text-slate-400 leading-relaxed">
                Once completion is confirmed, payment is released to the guard&apos;s connected Stripe account. Bank arrival depends on Stripe payout timing, and both sides can leave a review.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628]" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div
            id="features-title"
            data-animate
            className={`text-center mb-16 transition-all duration-1000 ${
              jsEnabled && !isVisible['features-title'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-award-line" aria-hidden="true"></i>
              Why Us
            </div>
            <h2 id="features-heading" className="text-4xl font-bold text-white mb-4">
              Why Choose QuickGuard?
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              A simple platform built for security professionals and the businesses that hire them, with SIA licence checks, held payments through Stripe and support when something needs review.
            </p>
          </div>

          <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 list-none p-0 m-0">
            <li
              id="feature-1"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center transition-all duration-1000 delay-200 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['feature-1'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-5 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-shield-check-line text-2xl text-teal-400"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Verified Guards</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Every guard must pass an SIA licence check before they can take work through QuickGuard. We are developing automated weekly re-checks that will flag suspended, revoked or expired licences for review.</p>
            </li>

            <li
              id="feature-2"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center transition-all duration-1000 delay-400 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['feature-2'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-5 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-money-pound-circle-line text-2xl text-teal-400"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Secure Payments</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Card payments are held by Stripe until you confirm the shift is complete, then released to the guard&apos;s connected Stripe account.</p>
            </li>

            <li
              id="feature-3"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center transition-all duration-1000 delay-600 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['feature-3'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-5 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-time-line text-2xl text-teal-400"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Guard responses</h3>
              <p className="text-slate-400 text-sm leading-relaxed">When you post a job, licensed guards whose settings match your location can be notified and can respond. Responses depend on their availability.</p>
            </li>

            <li
              id="feature-4"
              data-animate
              className={`bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 text-center transition-all duration-1000 delay-800 hover:border-teal-500/30 hover:scale-[1.02] ${
                jsEnabled && !isVisible['feature-4'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
              }`}
            >
              <div
                className="w-16 h-16 flex items-center justify-center bg-teal-500/10 rounded-2xl mx-auto mb-5 border border-teal-400/20"
                aria-hidden="true"
              >
                <i className="ri-customer-service-2-line text-2xl text-teal-400"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Support and guidance</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Help articles cover posting, selecting and paying. You can raise a support ticket from your dashboard when you need a person to review an issue.</p>
            </li>
          </ul>
        </div>
      </section>

      <TrustBadges />

      {showStatsSection && (
      <section className="py-20 bg-[#0B1933] border-y border-slate-800/60" aria-labelledby="stats-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <h2 id="stats-heading" className="sr-only">
            Platform Statistics
          </h2>
          <div
            id="stats"
            data-animate
            className={`grid md:grid-cols-4 gap-8 text-center transition-all duration-1000 ${
              jsEnabled && !isVisible['stats'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
            }`}
            role="group"
            aria-label="Platform statistics"
          >
            {showGuards && (
            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  <span>{stats.totalGuards !== null ? `${stats.totalGuards.toLocaleString()}+` : ''}</span>
                </div>
                <figcaption className="text-slate-400 font-medium">Guard profiles</figcaption>
              </div>
            </figure>
            )}

            {showJobs && (
            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  <span>{stats.completedJobs !== null ? `${stats.completedJobs.toLocaleString()}+` : ''}</span>
                </div>
                <figcaption className="text-slate-400 font-medium">Jobs Completed</figcaption>
              </div>
            </figure>
            )}

            {showClients && (
            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  <span>{stats.activeClients !== null ? `${stats.activeClients.toLocaleString()}+` : ''}</span>
                </div>
                <figcaption className="text-slate-400 font-medium">Active Clients</figcaption>
              </div>
            </figure>
            )}

            {showSuccessRate && (
              <figure className="group">
                <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                  <div className="text-4xl font-bold text-teal-400 mb-2">
                    <span>{stats.successRate !== null ? `${stats.successRate}%` : ''}</span>
                  </div>
                  <figcaption className="text-slate-400 font-medium">Completed assignment rate</figcaption>
                </div>
              </figure>
            )}
          </div>
        </div>
      </section>
      )}

      <section className="py-20 bg-[#0B1933] border-y border-slate-800/60" aria-labelledby="cities-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-map-pin-line" aria-hidden="true"></i>
              UK Cities
            </div>
            <h2 id="cities-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Security Guard Jobs in Major UK Cities
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              You can post a job in these cities. Local guards can respond if they are available, so cover is not guaranteed everywhere.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/security-guards/london" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">London</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs across Greater London, subject to local availability.</p>
            </Link>
            <Link href="/security-guards/manchester" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Manchester</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Manchester, Salford and Trafford.</p>
            </Link>
            <Link href="/security-guards/birmingham" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Birmingham</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Birmingham and the West Midlands.</p>
            </Link>
            <Link href="/security-guards/leeds" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Leeds</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Leeds and West Yorkshire.</p>
            </Link>
            <Link href="/security-guards/liverpool" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Liverpool</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Liverpool and Merseyside.</p>
            </Link>
            <Link href="/security-guards/glasgow" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Glasgow</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Glasgow and the surrounding area.</p>
            </Link>
            <Link href="/security-guards/edinburgh" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Edinburgh</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Edinburgh and the Lothians.</p>
            </Link>
            <Link href="/security-guards/bristol" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Bristol</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Bristol and the South West.</p>
            </Link>
            <Link href="/security-guards/cardiff" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Cardiff</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Guard jobs in Cardiff and South Wales.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#0e1628] relative overflow-hidden" aria-labelledby="cta-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
          <div
            id="cta"
            data-animate
            className={`transition-all duration-1000 ${
              jsEnabled && !isVisible['cta'] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-rocket-line" aria-hidden="true"></i>
              Get Started Today
            </div>
            <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
              Post your first job free, or sign up as a guard and start picking up shifts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/client/register"
                prefetch={false}
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none"
              >
                I Need Security Guards
              </Link>
              <Link
                href="/guard/register"
                prefetch={false}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm"
              >
                I Am a Security Guard
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              Free to create an account &middot; Pay per job &middot; Cancel subscriptions anytime
            </p>
          </div>
        </div>
      </section>
    </>
  );
}