'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TrustBadges from './TrustBadges';

export default function HomepageClient() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const [jsEnabled, setJsEnabled] = useState(false);
  const [stats, setStats] = useState({
    totalGuards: 0,
    completedJobs: 0,
    activeClients: 0,
    successRate: 0,
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
          successRate,
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
              Our AI-powered platform streamlines the process of connecting security professionals with clients
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
              <h3 className="text-xl font-semibold mb-4 text-white">Guards Create Profiles</h3>
              <p className="text-slate-400 leading-relaxed">
                Upload certifications, highlight experience, and set availability to build a strong, hire-ready profile.
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
              <h3 className="text-xl font-semibold mb-4 text-white">Clients Post Jobs</h3>
              <p className="text-slate-400 leading-relaxed">
                Submit assignment details—location, duration, needs—and find matching guards fast.
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
              <h3 className="text-xl font-semibold mb-4 text-white">AI Matches &amp; Connects</h3>
              <p className="text-slate-400 leading-relaxed">
                Smart matching connects the most qualified guards based on skills, proximity, and real-time availability.
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
              A secure, efficient platform trusted by security professionals and businesses across the UK
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
              <p className="text-slate-400 text-sm leading-relaxed">All security professionals are SIA-licensed, background checked and certified</p>
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
              <p className="text-slate-400 text-sm leading-relaxed">Protected payment system with job completion confirmation</p>
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
              <h3 className="text-lg font-semibold mb-2 text-white">Quick Matching</h3>
              <p className="text-slate-400 text-sm leading-relaxed">AI-powered system finds the right guard for your needs in minutes</p>
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
              <h3 className="text-lg font-semibold mb-2 text-white">24/7 Support</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Round-the-clock customer support for all users</p>
            </li>
          </ul>
        </div>
      </section>

      <TrustBadges />

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
            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  {loadingStats ? (
                    <div role="status" aria-live="polite">
                      <div
                        className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto"
                        aria-hidden="true"
                      ></div>
                      <span className="sr-only">Loading verified guards count</span>
                    </div>
                  ) : (
                    <span>{stats.totalGuards.toLocaleString()}+</span>
                  )}
                </div>
                <figcaption className="text-slate-400 font-medium">Verified Guards</figcaption>
              </div>
            </figure>

            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  {loadingStats ? (
                    <div role="status" aria-live="polite">
                      <div
                        className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto"
                        aria-hidden="true"
                      ></div>
                      <span className="sr-only">Loading completed jobs count</span>
                    </div>
                  ) : (
                    <span>{stats.completedJobs.toLocaleString()}+</span>
                  )}
                </div>
                <figcaption className="text-slate-400 font-medium">Jobs Completed</figcaption>
              </div>
            </figure>

            <figure className="group">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                <div className="text-4xl font-bold text-teal-400 mb-2">
                  {loadingStats ? (
                    <div role="status" aria-live="polite">
                      <div
                        className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto"
                        aria-hidden="true"
                      ></div>
                      <span className="sr-only">Loading active clients count</span>
                    </div>
                  ) : (
                    <span>{stats.activeClients.toLocaleString()}+</span>
                  )}
                </div>
                <figcaption className="text-slate-400 font-medium">Active Clients</figcaption>
              </div>
            </figure>

            {(!loadingStats && stats.successRate > 0) && (
              <figure className="group">
                <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1">
                  <div className="text-4xl font-bold text-teal-400 mb-2">
                    <span>{stats.successRate}%</span>
                  </div>
                  <figcaption className="text-slate-400 font-medium">Success Rate</figcaption>
                </div>
              </figure>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933] border-y border-slate-800/60" aria-labelledby="cities-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-map-pin-line" aria-hidden="true"></i>
              UK Coverage
            </div>
            <h2 id="cities-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Security Guards in Major UK Cities
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              QuickGuard operates nationwide with strong local presence in the UK&apos;s biggest cities
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
              <p className="text-slate-400 text-sm leading-relaxed">850+ verified guards across all 32 Greater London boroughs. Same-day deployment available.</p>
            </Link>
            <Link href="/security-guards/manchester" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Manchester</h3>
              <p className="text-slate-400 text-sm leading-relaxed">420+ verified guards across Greater Manchester. From city centre to Salford and Trafford.</p>
            </Link>
            <Link href="/security-guards/birmingham" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Birmingham</h3>
              <p className="text-slate-400 text-sm leading-relaxed">380+ verified guards across Birmingham and the West Midlands. Instant matching, fast deployment.</p>
            </Link>
            <Link href="/security-guards/leeds" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Leeds</h3>
              <p className="text-slate-400 text-sm leading-relaxed">290+ verified guards across West Yorkshire. Trinity Leeds, Elland Road, and beyond.</p>
            </Link>
            <Link href="/security-guards/liverpool" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Liverpool</h3>
              <p className="text-slate-400 text-sm leading-relaxed">260+ verified guards across Merseyside. From Albert Dock events to Anfield match days.</p>
            </Link>
            <Link href="/security-guards/glasgow" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Glasgow</h3>
              <p className="text-slate-400 text-sm leading-relaxed">240+ verified guards across Greater Glasgow. SEC events, retail, and corporate coverage.</p>
            </Link>
            <Link href="/security-guards/edinburgh" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Edinburgh</h3>
              <p className="text-slate-400 text-sm leading-relaxed">210+ verified guards across the Lothians. Festival security, retail, and corporate guarding.</p>
            </Link>
            <Link href="/security-guards/bristol" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Bristol</h3>
              <p className="text-slate-400 text-sm leading-relaxed">230+ verified guards across the South West. Cabot Circus, Ashton Gate, and beyond.</p>
            </Link>
            <Link href="/security-guards/cardiff" prefetch={false} className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                </div>
                <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Cardiff</h3>
              <p className="text-slate-400 text-sm leading-relaxed">180+ verified guards across Wales. Principality Stadium events, St David&apos;s retail, and more.</p>
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
              Join thousands of security professionals and businesses across the UK who trust QuickGuard
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
              No credit card required &middot; First month free &middot; Cancel anytime
            </p>
          </div>
        </div>
      </section>
    </>
  );
}