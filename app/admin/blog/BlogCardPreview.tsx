'use client';

import {
  COVER_FALLBACK,
  audienceLabel,
  audienceStyle,
  formatBlogDate,
  readingTimeMinutes,
  type BlogAudience,
} from '@/lib/blog';

interface BlogCardPreviewProps {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  audience: BlogAudience;
  tags: string[];
  dateValue: string | null;
}

export default function BlogCardPreview({
  title,
  excerpt,
  content,
  coverImage,
  audience,
  tags,
  dateValue,
}: BlogCardPreviewProps) {
  const displayTitle = title.trim() || 'Your post title appears here';
  const body = excerpt.trim() || content.trim().slice(0, 140);
  const displayExcerpt = body || 'The excerpt shows here, wrapping up to three lines exactly as it will on the blog listing.';
  const date = formatBlogDate(dateValue) || formatBlogDate(new Date().toISOString());
  const audienceIcon =
    audience === 'guard'
      ? 'ri-shield-user-line'
      : audience === 'client'
        ? 'ri-building-2-line'
        : 'ri-team-line';

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-semibold text-slate-400">Listing preview</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-400">
          <span className="w-3 h-3 flex items-center justify-center">
            <i className="ri-eye-line text-[11px]" aria-hidden="true" />
          </span>
          Live
        </span>
      </div>

      <div className="rounded-xl bg-[#0e1628] border border-[#1a2b4a] p-3">
        <article className="h-full flex flex-col bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="relative aspect-[16/9] overflow-hidden bg-[#0B1933]">
            <img
              src={coverImage || COVER_FALLBACK}
              alt=""
              className="w-full h-full object-cover object-top"
            />
            <span
              className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${audienceStyle(audience)}`}
            >
              <span className="w-3 h-3 flex items-center justify-center">
                <i className={`${audienceIcon} text-[11px]`} aria-hidden="true" />
              </span>
              {audienceLabel(audience)}
            </span>
          </div>

          <div className="flex flex-col flex-1 p-5">
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-calendar-line text-xs" aria-hidden="true" />
                </span>
                {date}
              </span>
              <span aria-hidden="true" className="text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-time-line text-xs" aria-hidden="true" />
                </span>
                {readingTimeMinutes(content)} min read
              </span>
            </div>

            <h3 className="text-lg font-semibold text-white leading-snug mb-2 break-words">
              {displayTitle}
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed flex-1 line-clamp-3 break-words">
              {displayExcerpt}
            </p>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-700/50">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400">
                Read article
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-right-line" aria-hidden="true" />
                </span>
              </span>
              {tags.length > 0 && (
                <span className="text-xs text-slate-500 truncate max-w-[45%]">#{tags[0]}</span>
              )}
            </div>
          </div>
        </article>
      </div>

      <p className="text-[11px] text-slate-600 mt-1.5">
        How it wraps at card width — excerpt is trimmed to three lines.
      </p>
    </div>
  );
}