import { Suspense } from 'react';
import type { Metadata } from 'next';
import PostJobWizard from './PostJobWizard';

export const metadata: Metadata = {
  title: 'Post a Security Guard Job UK | QuickGuard',
  description:
    'Post a security guard job in minutes. Hire SIA-licensed guards for events, retail, construction, and more across the UK. No agency fees.',
  keywords:
    'post security job UK, hire security guard, security staffing, event security booking, QuickGuard post job',
  alternates: {
    canonical: 'https://quickguard.uk/post-job',
  },
  openGraph: {
    title: 'Post a Security Guard Job UK | QuickGuard',
    description: 'Post a security guard job in minutes. Hire SIA-licensed guards across the UK.',
    url: 'https://quickguard.uk/post-job',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function PostJobPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PostJobWizard />
      <section aria-labelledby="post-job-guide-title" className="bg-[#0B1933] border-t border-slate-800 py-12">
        <div className="mx-auto max-w-4xl px-6 text-slate-300">
          <h2 id="post-job-guide-title" className="text-2xl font-bold text-white">
            How to post a security guard job on QuickGuard
          </h2>
          <p className="mt-4 leading-7">
            Tell us where you need cover, what kind of security role you are filling,
            and the dates, hours and number of guards required. You can include
            specific instructions so applicants understand your shift before applying.
          </p>
          <h3 className="mt-8 text-lg font-semibold text-white">Find suitable SIA-licensed guards</h3>
          <p className="mt-3 leading-7">
            QuickGuard helps UK businesses arrange security cover for events, shops,
            venues, construction sites and other premises. Review available guard
            information and check that the licence type suits the work you need.
          </p>
          <h3 className="mt-8 text-lg font-semibold text-white">Review details before confirming</h3>
          <p className="mt-3 leading-7">
            The booking process lets you enter your requirements and review the
            relevant details before committing to a booking. Any applicable platform
            fees and confirmed payment amount are displayed before payment.
          </p>
        </div>
      </section>
    </Suspense>
  );
}