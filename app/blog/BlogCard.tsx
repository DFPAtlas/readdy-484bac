import Link from 'next/link';
import {
  COVER_FALLBACK,
  audienceLabel,
  audienceStyle,
  formatBlogDate,
  postHref,
  readingTimeMinutes,
  type BlogPost,
} from '@/lib/blog';

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <article className="group h-full flex flex-col bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden hover:border-teal-500/40 transition-all duration-300">
      <Link href={postHref(post.slug)} prefetch={false} className="block relative aspect-[16/9] overflow-hidden">
        <img
          src={post.cover_image_url || COVER_FALLBACK}
          alt={post.title}
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${audienceStyle(post.audience)}`}
        >
          <span className="w-3 h-3 flex items-center justify-center">
            <i
              className={
                post.audience === 'guard'
                  ? 'ri-shield-user-line text-[11px]'
                  : post.audience === 'client'
                    ? 'ri-building-2-line text-[11px]'
                    : 'ri-team-line text-[11px]'
              }
              aria-hidden="true"
            />
          </span>
          {audienceLabel(post.audience)}
        </span>
      </Link>

      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-calendar-line text-xs" aria-hidden="true" />
            </span>
            {formatBlogDate(post.published_at || post.created_at)}
          </span>
          <span aria-hidden="true" className="text-slate-700">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-time-line text-xs" aria-hidden="true" />
            </span>
            {readingTimeMinutes(post.content)} min read
          </span>
        </div>

        <h3 className="text-lg font-semibold text-white leading-snug mb-2 group-hover:text-teal-300 transition-colors">
          <Link href={postHref(post.slug)} prefetch={false}>
            {post.title}
          </Link>
        </h3>

        <p className="text-sm text-slate-400 leading-relaxed flex-1 line-clamp-3">
          {post.excerpt || post.content.slice(0, 140)}
        </p>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-700/50">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400">
            Read article
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </span>
          {post.tags && post.tags.length > 0 && (
            <span className="text-xs text-slate-500 truncate max-w-[45%]">#{post.tags[0]}</span>
          )}
        </div>
      </div>
    </article>
  );
}