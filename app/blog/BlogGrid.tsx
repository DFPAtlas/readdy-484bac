'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/blog';
import BlogCard from './BlogCard';
import FeaturedPost from './FeaturedPost';

const PAGE_SIZE = 9;

type FilterKey = 'all' | 'client' | 'guard';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'ri-layout-grid-line' },
  { key: 'client', label: 'For Clients', icon: 'ri-building-2-line' },
  { key: 'guard', label: 'For Guards', icon: 'ri-shield-user-line' },
];

export default function BlogGrid() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, content, cover_image_url, audience, tags, status, published_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(120);

      if (cancelled) return;
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return posts;
    return posts.filter((post) => post.audience === filter || post.audience === 'both' || !post.audience);
  }, [posts, filter]);

  const totalPages = Math.max(1, Math.ceil((filtered.length - 1) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const featured = filtered[0];
  const listed = filtered.slice(1);
  const visible = listed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Latest articles</h2>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? 'Loading articles…' : `${filtered.length} article${filtered.length === 1 ? '' : 's'} published`}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#111d35] border border-slate-700/60 rounded-full" role="tablist" aria-label="Filter articles by audience">
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'bg-teal-500 text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={`${item.icon} text-sm`} aria-hidden="true" />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && featured && <FeaturedPost post={featured} />}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="bg-[#111d35] border border-slate-700/40 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-slate-700/30" />
              <div className="p-6 space-y-3">
                <div className="h-3 w-24 bg-slate-700/40 rounded" />
                <div className="h-4 w-full bg-slate-700/40 rounded" />
                <div className="h-4 w-4/5 bg-slate-700/30 rounded" />
                <div className="h-3 w-full bg-slate-700/20 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 && !featured ? (
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-500/10 border border-teal-400/20 flex items-center justify-center">
            <i className="ri-article-line text-2xl text-teal-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No articles here yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            New guidance is published regularly. Try another filter, or subscribe below to be told when the next article goes live.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors whitespace-nowrap ${
              safePage === 1
                ? 'border-slate-700/40 text-slate-600 cursor-not-allowed'
                : 'border-slate-700/60 text-slate-300 hover:border-teal-400/50 hover:text-teal-300 cursor-pointer'
            }`}
            aria-label="Previous page"
          >
            <i className="ri-arrow-left-s-line text-lg" aria-hidden="true" />
          </button>

          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            return (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                aria-current={pageNumber === safePage ? 'page' : undefined}
                className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  pageNumber === safePage
                    ? 'bg-teal-500 border-teal-500 text-slate-900'
                    : 'border-slate-700/60 text-slate-300 hover:border-teal-400/50 hover:text-teal-300'
                }`}
              >
                {pageNumber}
              </button>
            );
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors whitespace-nowrap ${
              safePage === totalPages
                ? 'border-slate-700/40 text-slate-600 cursor-not-allowed'
                : 'border-slate-700/60 text-slate-300 hover:border-teal-400/50 hover:text-teal-300 cursor-pointer'
            }`}
            aria-label="Next page"
          >
            <i className="ri-arrow-right-s-line text-lg" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}