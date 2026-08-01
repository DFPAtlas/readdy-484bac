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
    </Suspense>
  );
}