'use client';
import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';
import Link from 'next/link';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Wide%20cinematic%20photograph%20of%20a%20professional%20SIA%20licensed%20security%20officer%20in%20a%20smart%20black%20uniform%20reviewing%20a%20tablet%20outside%20a%20modern%20UK%20venue%20at%20dusk%2C%20blurred%20city%20lights%20and%20glass%20architecture%20behind%2C%20deep%20navy%20blue%20and%20teal%20colour%20grade%2C%20left%20half%20of%20the%20image%20kept%20dark%20and%20uncluttered%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%2C%20sharp%20realistic%20detail%2C%20calm%20trustworthy%20atmosphere&width=1600&height=900&seq=blog_hero_20261118&orientation=landscape';

const TOPICS = ['Hiring guards', 'Event security', 'Licence checks', 'Pay'];

export default function BlogHero() {
  const managed = usePublicMediaBackground('blog-hero', HERO_IMAGE);
  return (
    <section
      className="relative w-full min-h-[580px] md:min-h-[640px] flex items-center bg-cover bg-center bg-no-repeat border-b border-slate-800/60"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 25, 51, 0.97) 0%, rgba(11, 25, 51, 0.9) 46%, rgba(11, 25, 51, 0.55) 100%), url('${managed}')`,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-400 list-none m-0 p-0">
            <li>
              <Link href="/" prefetch={false} className="hover:text-teal-400 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-600">/</li>
            <li className="text-slate-300" aria-current="page">Blog</li>
          </ol>
        </nav>

        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-article-line" aria-hidden="true" />
            </span>
            Security insights
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.08] text-white">
            Practical guidance for UK security.
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-xl">
            Short, useful articles on hiring SIA-licensed guards, planning event security, licence checks and pay — written for UK businesses and the guards who work with them.
          </p>

          <ul className="flex flex-wrap items-center gap-2 mt-7 list-none m-0 p-0">
            {TOPICS.map((topic) => (
              <li
                key={topic}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 backdrop-blur-sm"
              >
                <i className="ri-checkbox-blank-circle-fill text-[5px] text-teal-400" aria-hidden="true" />
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}