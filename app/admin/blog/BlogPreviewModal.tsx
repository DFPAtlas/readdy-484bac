'use client';

import { useEffect } from 'react';
import { COVER_FALLBACK, audienceLabel, audienceStyle, formatBlogDate, metaDescriptionFor, metaTitleFor, readingTimeMinutes, type BlogPost } from '@/lib/blog';
import MarkdownBody from '@/components/blog/MarkdownBody';

export default function BlogPreviewModal({ post, onClose }: { post: BlogPost; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-[#0B1933] border border-[#1a2b4a] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1a2b4a] bg-[#111d35] sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 flex items-center justify-center text-teal-400">
              <i className="ri-eye-line text-sm" />
            </span>
            <p className="text-sm font-semibold text-white truncate">Preview — public blog view</p>
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full whitespace-nowrap">
              Not live
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${audienceStyle(post.audience)}`}>
            {audienceLabel(post.audience)}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 mb-3 leading-tight">{post.title}</h1>
          {post.excerpt && <p className="text-slate-400 leading-relaxed mb-4">{post.excerpt}</p>}

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-6">
            <span>{formatBlogDate(post.published_at || post.created_at)}</span>
            <span>{readingTimeMinutes(post.content)} min read</span>
            <span className="font-mono text-slate-600">/blog/{post.slug}</span>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#1a2b4a] mb-6">
            <img src={post.cover_image_url || COVER_FALLBACK} alt={post.title} className="w-full aspect-[16/9] object-cover object-top" />
          </div>

          <MarkdownBody content={post.content} />

          <div className="mt-8 pt-5 border-t border-[#1a2b4a] space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Search preview</p>
            <p className="text-teal-300 text-sm font-medium">{metaTitleFor(post)}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{metaDescriptionFor(post)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}