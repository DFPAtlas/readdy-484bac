'use client';

import Link from 'next/link';
import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';

interface HeroProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  ctaLabel: string;
}

export default function BuildingSitesHero({ eyebrow, headline, subheadline, heroImage, ctaLabel }: HeroProps) {
  const background = usePublicMediaBackground('security-for-building-sites-hero', heroImage);

  return (
    <section
      className="relative min-h-[560px] md:min-h-[640px] flex items-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.88) 55%, rgba(11, 26, 51, 0.55) 100%), url('${background}')`,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
            <i className="ri-shield-check-line" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
            {headline}
          </h1>
          <p className="text-lg md:text-xl mb-8 text-slate-300 max-w-xl leading-relaxed">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/client/register"
              prefetch={false}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none text-center cursor-pointer"
            >
              {ctaLabel}
            </Link>
            <Link
              href="/find-a-guard"
              prefetch={false}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm text-center cursor-pointer"
            >
              Browse Guards
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400 leading-relaxed max-w-lg">
            A recorded availability check is an indicator only. It is not a reservation and does not guarantee cover, and no job is posted
            or guard notified until you sign in, review and confirm the posting yourself.
          </p>
        </div>
      </div>
    </section>
  );
}