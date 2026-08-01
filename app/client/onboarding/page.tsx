'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useClientGuard } from '@/hooks/useClientGuard';
import ClientOnboardingAgent from '@/components/ClientOnboardingAgent';

export default function ClientOnboardingPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/client/login');
        return;
      }

      if (!mountedRef.current) return;
      setUserEmail(user.email || '');
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'there');

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, profile_completed, onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (!clientData) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      if (!clientData.profile_completed) {
        router.push('/client/complete-profile-wizard');
        return;
      }

      setCompanyName(clientData.company_name || clientData.contact_name || '');
      setLoading(false);
    };

    init();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
            <i className="ri-check-line text-4xl text-white w-10 h-10 flex items-center justify-center"></i>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Welcome aboard{companyName ? `, ${companyName}` : ''}!
          </h1>
          <p className="text-lg text-slate-400 max-w-lg mx-auto">
            Your profile is complete and you&apos;re ready to start hiring SIA-licensed security guards. Here&apos;s what happens next.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-building-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">Company Profile</p>
            <p className="text-white font-semibold">Complete</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-user-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">Contact Details</p>
            <p className="text-white font-semibold">Saved</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 text-center">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-map-pin-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-slate-400 mb-1">Location</p>
            <p className="text-white font-semibold">Set</p>
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center">
              <i className="ri-road-map-line text-teal-400 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            Your Journey
          </h2>

          <div className="space-y-0">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-check-line text-white text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="w-0.5 flex-1 bg-emerald-500/30 my-1"></div>
              </div>
              <div className="pb-6">
                <h3 className="text-white font-semibold mb-1">Account Created</h3>
                <p className="text-sm text-slate-400">Your business account is active and ready to use. You can log in anytime at <strong className="text-slate-300">{userEmail}</strong>.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-check-line text-white text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="w-0.5 flex-1 bg-emerald-500/30 my-1"></div>
              </div>
              <div className="pb-6">
                <h3 className="text-white font-semibold mb-1">Profile Complete</h3>
                <p className="text-sm text-slate-400">Your company details, contact information, and preferences are all saved. You can update them anytime from your dashboard.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                  <i className="ri-flashlight-line text-white text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="w-0.5 flex-1 bg-teal-500/20 my-1"></div>
              </div>
              <div className="pb-6">
                <h3 className="text-white font-semibold mb-1">Post Your First Job</h3>
                <p className="text-sm text-slate-400">Create a security job posting in under 2 minutes. Describe the role, set the rate, and we&apos;ll match you with qualified guards near your location.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-[#162236] border-2 border-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-shield-star-line text-slate-500 text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Hire Verified Guards</h3>
                <p className="text-sm text-slate-400">Review applicants, check their SIA licences and ratings, then select the best guards for your shift. Pay securely through our held payment system with Stripe — guards are only paid after the job is completed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link
            href="/client/dashboard"
            className="flex-1 px-6 py-4 bg-teal-500 text-slate-900 rounded-2xl font-bold text-center hover:bg-teal-400 transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-dashboard-line text-xl w-5 h-5 flex items-center justify-center"></i>
            Go to Dashboard
          </Link>
          <Link
            href="/client/post-job"
            className="flex-1 px-6 py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-bold text-center hover:bg-white/20 transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-add-circle-line text-xl w-5 h-5 flex items-center justify-center"></i>
            Post Your First Job
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-information-line text-amber-400 text-lg w-5 h-5 flex items-center justify-center"></i>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Recommended Next Steps</h3>
                <p className="text-sm text-slate-400">Get the most out of QuickGuard:</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span><Link href="/client/profile?tab=billing" className="text-teal-400 hover:text-teal-300 underline">Set up billing</Link> — add VAT number and billing address</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span><Link href="/client/profile?tab=contacts" className="text-teal-400 hover:text-teal-300 underline">Add site contacts</Link> — who guards check in with on site</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span><Link href="/client/profile?tab=preferences" className="text-teal-400 hover:text-teal-300 underline">Configure notifications</Link> — stay on top of applicants and shifts</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                <span>Read our <Link href="/guide/client" className="text-teal-400 hover:text-teal-300 underline">client guide</Link> for tips on hiring guards</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-lightbulb-line text-blue-400 text-lg w-5 h-5 flex items-center justify-center"></i>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Why QuickGuard?</h3>
                <p className="text-sm text-slate-400">What makes us different:</p>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-200 mb-1">All Guards Are SIA-Licensed</p>
                <p className="text-slate-400">Every guard on our platform has a verified SIA licence. No exceptions, no compromises on safety.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">Held Job Payment Protection</p>
                <p className="text-slate-400">Your payment is held securely until the shift is completed. Guards are only paid when the job is done — no risk to you.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">No Long-Term Contracts</p>
                <p className="text-slate-400">Book by the shift. Need guards for one night? A weekend? Ongoing? You decide — no lock-in, no hassle.</p>
              </div>
              <div>
                <p className="font-medium text-slate-200 mb-1">Fast Matching</p>
                <p className="text-slate-400">Qualified guards near your location get notified instantly. Most jobs receive applications within hours.</p>
              </div>
            </div>
          </div>
        </div>

        <ClientOnboardingAgent
          clientId={null}
          hasJobs={false}
          isFreeOrStarter={true}
          profileCompleted={true}
          page="onboarding"
        />

        <div className="text-center">
          <p className="text-xs text-slate-600">
            You can explore your dashboard and start posting jobs straight away. Everything is ready.
          </p>
        </div>
      </div>
    </div>
  );
}