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

export default function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <article className="group relative mb-10 overflow-hidden rounded-3xl border border-teal-500/25 bg-[#111d35] transition-all duration-300 hover:border-teal-400/50">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-transparent" />

      <div className="relative grid lg:grid-cols-[1.05fr_1fr] gap-0">
        <Link
          href={postHref(post.slug)}
          prefetch={false}
          className="block relative aspect-[16/10] lg:aspect-auto lg:h-full overflow-hidden"
        >
          <img
            src={post.cover_image_url || COVER_FALLBACK}
            alt={post.title}
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200 backdrop-blur-sm">
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <i className="ri-star-smile-line text-[11px]" aria-hidden="true" />
            </span>
            Latest article
          </span>
        </Link>

        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${audienceStyle(post.audience)}`}>
              <span className="flex h-3 w-3 items-center justify-center">
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
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <i className="ri-calendar-line text-xs" aria-hidden="true" />
              </span>
              {formatBlogDate(post.published_at || post.created_at)}
            </span>
            <span aria-hidden="true" className="text-slate-700">•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <i className="ri-time-line text-xs" aria-hidden="true" />
              </span>
              {readingTimeMinutes(post.content)} min read
            </span>
          </div>

          <h3 className="mb-3 text-2xl font-bold leading-tight text-white transition-colors group-hover:text-teal-300 sm:text-3xl">
            <Link href={postHref(post.slug)} prefetch={false}>
              {post.title}
            </Link>
          </h3>

          <p className="mb-6 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base line-clamp-3">
            {post.excerpt || post.content.slice(0, 180)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={postHref(post.slug)}
              prefetch={false}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-teal-400"
            >
              Read the article
              <span className="flex h-4 w-4 items-center justify-center">
                <i className="ri-arrow-right-line" aria-hidden="true" />
              </span>
            </Link>
            {post.tags && post.tags.length > 0 && (
              <span className="text-xs text-slate-500">#{post.tags[0]}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}