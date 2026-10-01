import Link from 'next/link';
import type { IndustryCtaLink } from './types';

interface Props {
  eyebrow: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  name: string;
  primaryCta: IndustryCtaLink;
  secondaryCta?: IndustryCtaLink;
}

export default function IndustryHero({ eyebrow, headline, subheadline, heroImage, name, primaryCta, secondaryCta }: Props) {
  return (
    <section
      aria-labelledby="industry-heading"
      className="relative min-h-[580px] md:min-h-[680px] flex items-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.96) 0%, rgba(11, 26, 51, 0.85) 52%, rgba(11, 26, 51, 0.45) 100%), url('${heroImage}')`,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-400 list-none m-0 p-0">
            <li>
              <Link href="/" prefetch={false} className="hover:text-teal-400 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-600">/</li>
            <li>
              <Link href="/industries" prefetch={false} className="hover:text-teal-400 transition-colors">
                Industries
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-600">/</li>
            <li className="text-slate-300" aria-current="page">{name}</li>
          </ol>
        </nav>

        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
            <i className="ri-shield-check-line" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 id="industry-heading" className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
            {headline}
          </h1>
          <p className="text-lg md:text-xl mb-9 text-slate-300 max-w-xl leading-relaxed">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={primaryCta.href}
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none shadow-lg hover:shadow-teal-500/20"
            >
              <i className="ri-user-search-line" aria-hidden="true" />
              {primaryCta.label}
            </Link>
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm"
              >
                <i className="ri-building-2-line" aria-hidden="true" />
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}