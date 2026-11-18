'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import {
  COVER_FALLBACK,
  audienceLabel,
  audienceStyle,
  formatBlogDate,
  readingTimeMinutes,
  type BlogPost,
} from '@/lib/blog';
import MarkdownBody from '@/components/blog/MarkdownBody';
import PostCta from './PostCta';

export default function BlogPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, content, cover_image_url, audience, tags, status, published_at, created_at, meta_title, meta_description')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (cancelled) return;
      setPost((data as BlogPost) || null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      {loading ? (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-slate-700/30 rounded" />
            <div className="h-10 w-full bg-slate-700/40 rounded" />
            <div className="h-10 w-3/4 bg-slate-700/30 rounded" />
            <div className="h-64 w-full bg-slate-700/20 rounded-2xl mt-8" />
          </div>
        </div>
      ) : !post ? (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-teal-500/10 border border-teal-400/20 flex items-center justify-center">
            <i className="ri-file-search-line text-2xl text-teal-400" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Article not available</h1>
          <p className="text-slate-400 mb-8">
            This article may have been moved or is no longer published.
          </p>
          <Link
            href="/blog"
            prefetch={false}
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line text-base" aria-hidden="true" />
            </span>
            Back to the blog
          </Link>
        </div>
      ) : (
        <article>
          <div className="border-b border-slate-800/60">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10">
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center flex-wrap gap-2 text-sm text-slate-400 list-none m-0 p-0">
                  <li>
                    <Link href="/" prefetch={false} className="hover:text-teal-400 transition-colors">Home</Link>
                  </li>
                  <li aria-hidden="true" className="text-slate-600">/</li>
                  <li>
                    <Link href="/blog" prefetch={false} className="hover:text-teal-400 transition-colors">Blog</Link>
                  </li>
                  <li aria-hidden="true" className="text-slate-600">/</li>
                  <li className="text-slate-300 truncate max-w-[220px]" aria-current="page">{post.title}</li>
                </ol>
              </nav>

              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${audienceStyle(post.audience)}`}
              >
                {audienceLabel(post.audience)}
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-white mt-4 mb-4 leading-[1.15]">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="text-lg text-slate-400 leading-relaxed mb-6">{post.excerpt}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-calendar-line text-sm" aria-hidden="true" />
                  </span>
                  {formatBlogDate(post.published_at || post.created_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-time-line text-sm" aria-hidden="true" />
                  </span>
                  {readingTimeMinutes(post.content)} min read
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-team-line text-sm" aria-hidden="true" />
                  </span>
                  QuickGuard Editorial
                </span>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="rounded-2xl overflow-hidden border border-slate-700/50 mb-10">
              <img
                src={post.cover_image_url || COVER_FALLBACK}
                alt={post.title}
                className="w-full aspect-[16/9] object-cover object-top"
              />
            </div>

            <MarkdownBody content={post.content} />

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-10">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium text-slate-400 bg-[#111d35] border border-slate-700/60 px-3 py-1.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <PostCta />

            <div className="mt-10 pt-8 border-t border-slate-800/60">
              <Link
                href="/blog"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-left-line text-base" aria-hidden="true" />
                </span>
                All articles
              </Link>
            </div>
          </div>
        </article>
      )}

      <Footer />
    </div>
  );
}