'use client';

import { COVER_FALLBACK, audienceLabel, audienceStyle, formatBlogDate, readingTimeMinutes, type BlogPost } from '@/lib/blog';

type TabKey = 'draft' | 'published' | 'rejected' | 'newsletter';

interface BlogPostListProps {
  posts: BlogPost[];
  loading: boolean;
  tab: TabKey;
  busyId: string | null;
  onCreate: () => void;
  onPreview: (post: BlogPost) => void;
  onEdit: (post: BlogPost) => void;
  onApprove: (post: BlogPost) => void;
  onReject: (post: BlogPost) => void;
  onUnpublish: (post: BlogPost) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  manual: 'Manual',
};

export default function BlogPostList({
  posts,
  loading,
  tab,
  busyId,
  onCreate,
  onPreview,
  onEdit,
  onApprove,
  onReject,
  onUnpublish,
}: BlogPostListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-14 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex items-center justify-center">
          <i className="ri-article-line text-2xl text-teal-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {tab === 'draft' ? 'No drafts waiting' : tab === 'published' ? 'Nothing published yet' : 'No rejected posts'}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {tab === 'draft'
            ? 'AI-generated drafts appear here for review. You can also write a post from scratch at any time.'
            : tab === 'published'
              ? 'Approved posts appear on the public blog immediately after publishing.'
              : 'Rejected posts are kept here so nothing is lost if you change your mind.'}
        </p>
        {tab === 'draft' && (
          <button
            onClick={onCreate}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-quill-pen-line" /></span>
            Write a post
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const busy = busyId === post.id;
        return (
          <article key={post.id} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 hover:border-teal-500/25 transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              <div className="hidden sm:block w-28 flex-shrink-0 rounded-lg overflow-hidden border border-[#1a2b4a] bg-[#0B1933]">
                <img
                  src={post.cover_image_url || COVER_FALLBACK}
                  alt=""
                  aria-hidden="true"
                  className="w-full aspect-video object-cover object-top"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${audienceStyle(post.audience)}`}>
                    {audienceLabel(post.audience)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 bg-[#0B1933] border border-[#1a2b4a] px-2 py-0.5 rounded-full whitespace-nowrap">
                    {SOURCE_LABELS[post.source || 'manual'] || post.source || 'Manual'}
                  </span>
                  {post.status === 'approved' && (
                    <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Approved
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-white leading-snug truncate">{post.title}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{post.excerpt || post.content.slice(0, 150)}</p>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-calendar-line text-xs" /></span>
                    Created {formatBlogDate(post.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-time-line text-xs" /></span>
                    {readingTimeMinutes(post.content)} min read
                  </span>
                  {post.published_at && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-check-line text-xs" /></span>
                      Published {formatBlogDate(post.published_at)}
                    </span>
                  )}
                  <span className="font-mono text-slate-600 truncate max-w-[220px]">/blog/{post.slug}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end flex-shrink-0">
                <button
                  onClick={() => onPreview(post)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0B1933] border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-eye-line text-xs" /></span>
                  Preview
                </button>
                <button
                  onClick={() => onEdit(post)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0B1933] border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-edit-line text-xs" /></span>
                  Edit
                </button>

                {tab === 'published' ? (
                  <button
                    onClick={() => onUnpublish(post)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg hover:bg-amber-500/20 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-eye-off-line text-xs" /></span>
                    Unpublish
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onApprove(post)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-check-line text-xs" /></span>
                      Approve &amp; Publish
                    </button>
                    {tab === 'draft' && (
                      <button
                        onClick={() => onReject(post)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg hover:bg-red-500/20 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-close-line text-xs" /></span>
                        Reject
                      </button>
                    )}
                    {tab === 'rejected' && (
                      <button
                        onClick={() => onUnpublish(post)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0B1933] border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-arrow-go-back-line text-xs" /></span>
                        Restore to drafts
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}