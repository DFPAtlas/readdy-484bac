'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const SectionFallback = ({ height = 'h-48' }: { height?: string }) => (
  <div className={`bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6 ${height} animate-pulse`}>
    <div className="h-5 bg-[#162036] rounded w-40 mb-4" />
    <div className="h-4 bg-[#162036] rounded w-full mb-2" />
    <div className="h-4 bg-[#162036] rounded w-3/4" />
  </div>
);

const CompactFallback = ({ height = 'h-32' }: { height?: string }) => (
  <div className={`bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6 ${height} animate-pulse`}>
    <div className="h-5 bg-[#162036] rounded w-32 mb-3" />
    <div className="h-4 bg-[#162036] rounded w-full mb-2" />
    <div className="h-4 bg-[#162036] rounded w-1/2" />
  </div>
);

const GridFallback = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="h-28 bg-[#162036] rounded-xl animate-pulse" />
    ))}
  </div>
);

export const DynamicAnalyticsWidget = dynamic(
  () => import('./AnalyticsWidget'),
  {
    loading: () => <SectionFallback height="h-64" />,
    ssr: false,
  }
);

export const DynamicCompletionApproval = dynamic(
  () => import('./CompletionApprovalPanel'),
  {
    loading: () => <CompactFallback />,
    ssr: false,
  }
);

export const DynamicRecentActivity = dynamic(
  () => import('./RecentActivity'),
  {
    loading: () => (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-32 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#162036] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    ),
    ssr: false,
  }
);

export const DynamicYourTemplates = dynamic(
  () => import('./YourTemplatesWidget'),
  {
    loading: () => (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-32 mb-4 animate-pulse" />
        <GridFallback />
      </div>
    ),
    ssr: false,
  }
);

export const DynamicTopRecommendedGuards = dynamic(
  () => import('./TopRecommendedGuards'),
  {
    loading: () => <CompactFallback />,
    ssr: false,
  }
);

export const DynamicClientOnboardingAgent = dynamic(
  () => import('@/components/ClientOnboardingAgent'),
  {
    loading: () => null,
    ssr: false,
  }
);