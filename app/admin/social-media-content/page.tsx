'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';

interface SocialPost {
  id: string;
  title: string;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_date: string | null;
  hashtags: string[];
  image_url: string | null;
  engagement_likes: number;
  engagement_shares: number;
  engagement_comments: number;
  reach: number;
  impressions: number;
  clicks: number;
  engagement_rate: number | null;
  created_at: string;
  updated_at: string;
}

interface SocialIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  used: boolean;
  created_at: string;
}

const statusStyles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  draft: { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: 'ri-draft-line', label: 'Draft' },
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'ri-calendar-check-line', label: 'Scheduled (draft)' },
  published: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'ri-check-double-line', label: 'Published' },
  archived: { bg: 'bg-slate-500/10', text: 'text-slate-500', icon: 'ri-archive-line', label: 'Archived' },
};

const platformIcons: Record<string, string> = {
  twitter: 'ri-twitter-x-line',
  facebook: 'ri-facebook-line',
  instagram: 'ri-instagram-line',
  linkedin: 'ri-linkedin-line',
  tiktok: 'ri-tiktok-line',
};

const platformColors: Record<string, string> = {
  twitter: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  facebook: 'bg-blue-600/10 text-blue-400 border-blue-600/20',
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  linkedin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  tiktok: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
};

const categoryStyles: Record<string, { bg: string; text: string; icon: string }> = {
  'security-tips': { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'ri-shield-line' },
  'social': { bg: 'bg-sky-500/10', text: 'text-sky-400', icon: 'ri-share-line' },
  'industry-news': { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'ri-newspaper-line' },
  'hiring': { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'ri-user-search-line' },
  'promotional': { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'ri-megaphone-line' },
  'behind-scenes': { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: 'ri-camera-line' },
  'client-success': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'ri-trophy-line' },
  'general': { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: 'ri-global-line' },
};

const allPlatforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'];

const ideaCategories = [
  { value: 'social', label: 'Social' },
  { value: 'security-tips', label: 'Security Tips' },
  { value: 'industry-news', label: 'Industry News' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'behind-scenes', label: 'Behind the Scenes' },
  { value: 'client-success', label: 'Client Success' },
  { value: 'general', label: 'General' },
];

const POSTS_PER_PAGE = 10;
const IDEAS_PER_PAGE = 12;

export default function SocialMediaContent() {
  const [activeTab, setActiveTab] = useState<'posts' | 'ideas'>('posts');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [ideas, setIdeas] = useState<SocialIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState<SocialIdea | null>(null);

  const [postsPage, setPostsPage] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [ideasPage, setIdeasPage] = useState(1);
  const [ideasTotal, setIdeasTotal] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishingDue, setPublishingDue] = useState(false);

  const [postsSearch, setPostsSearch] = useState('');
  const [postsSearchDebounced, setPostsSearchDebounced] = useState('');
  const [postsPlatformFilter, setPostsPlatformFilter] = useState('');
  const [postsStatusFilter, setPostsStatusFilter] = useState('');
  const [ideasSearch, setIdeasSearch] = useState('');
  const [ideasSearchDebounced, setIdeasSearchDebounced] = useState('');
  const [ideasCategoryFilter, setIdeasCategoryFilter] = useState('');
  const [ideasPriorityFilter, setIdeasPriorityFilter] = useState('');
  const [ideasUsedFilter, setIdeasUsedFilter] = useState('');

  const postsSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ideasSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPosts = useCallback(async () => {
    let query = supabase.from('social_media_posts').select('*', { count: 'exact', head: false });

    if (postsSearchDebounced.trim()) {
      const term = `%${postsSearchDebounced.trim()}%`;
      query = query.or(`title.ilike.${term},content.ilike.${term}`);
    }
    if (postsPlatformFilter) {
      query = query.contains('platforms', [postsPlatformFilter]);
    }
    if (postsStatusFilter) {
      query = query.eq('status', postsStatusFilter);
    }

    const from = (postsPage - 1) * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) { showToast('Failed to load posts.', 'error'); return; }
    setPosts(data || []);
    setPostsTotal(count || 0);
  }, [showToast, postsPage, postsSearchDebounced, postsPlatformFilter, postsStatusFilter]);

  const fetchIdeas = useCallback(async () => {
    let query = supabase.from('social_media_ideas').select('*', { count: 'exact', head: false });

    if (ideasSearchDebounced.trim()) {
      const term = `%${ideasSearchDebounced.trim()}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }
    if (ideasCategoryFilter) {
      query = query.eq('category', ideasCategoryFilter);
    }
    if (ideasPriorityFilter) {
      query = query.eq('priority', ideasPriorityFilter);
    }
    if (ideasUsedFilter !== '') {
      query = query.eq('used', ideasUsedFilter === 'used');
    }

    const from = (ideasPage - 1) * IDEAS_PER_PAGE;
    const to = from + IDEAS_PER_PAGE - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) { showToast('Failed to load ideas.', 'error'); return; }
    setIdeas(data || []);
    setIdeasTotal(count || 0);
  }, [showToast, ideasPage, ideasSearchDebounced, ideasCategoryFilter, ideasPriorityFilter, ideasUsedFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPosts(), fetchIdeas()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  useEffect(() => {
    if (postsSearchTimer.current) clearTimeout(postsSearchTimer.current);
    postsSearchTimer.current = setTimeout(() => {
      setPostsSearchDebounced(postsSearch);
      setPostsPage(1);
    }, 300);
    return () => { if (postsSearchTimer.current) clearTimeout(postsSearchTimer.current); };
  }, [postsSearch]);

  useEffect(() => {
    if (ideasSearchTimer.current) clearTimeout(ideasSearchTimer.current);
    ideasSearchTimer.current = setTimeout(() => {
      setIdeasSearchDebounced(ideasSearch);
      setIdeasPage(1);
    }, 300);
    return () => { if (ideasSearchTimer.current) clearTimeout(ideasSearchTimer.current); };
  }, [ideasSearch]);

  useEffect(() => { setPostsPage(1); }, [postsPlatformFilter, postsStatusFilter]);
  useEffect(() => { setIdeasPage(1); }, [ideasCategoryFilter, ideasPriorityFilter, ideasUsedFilter]);

  const fetchDueCount = useCallback(async () => {
    const now = new Date().toISOString();
    const { count, error } = await supabase
      .from('social_media_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .not('scheduled_date', 'is', null)
      .lte('scheduled_date', now);
    if (!error) setDueCount(count || 0);
  }, []);

  const fetchPublishedCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('social_media_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');
    if (!error) setPublishedCount(count || 0);
  }, []);

  useEffect(() => { fetchDueCount(); fetchPublishedCount(); }, [fetchDueCount, fetchPublishedCount]);

  async function publishDuePosts() {
    setPublishingDue(true);
    try {
      const res = await fetch('https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/publish-scheduled-posts', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        showToast(`Published ${json.published} post${json.published !== 1 ? 's' : ''}.`, 'success');
        setDueCount(0);
        fetchPublishedCount();
        await fetchPosts();
      } else {
        showToast(json.error || 'Publish failed.', 'error');
      }
    } catch {
      showToast('Failed to reach scheduler.', 'error');
    } finally {
      setPublishingDue(false);
    }
  }

  function parseHashtags(input: string): string[] {
    return input
      .split(',')
      .map((h) => h.trim().replace(/^#+/, '').replace(/[^\w\s-]/g, '').trim().toLowerCase())
      .filter((h) => h.length > 0 && h.length <= 60);
  }

  function isValidImageUrl(url: string): boolean {
    if (!url.trim()) return true;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  async function savePost(post: Partial<SocialPost>) {
    if (!post.title?.trim() || !post.content?.trim()) {
      showToast('Title and content are required.', 'error');
      return;
    }
    if (post.image_url && !isValidImageUrl(post.image_url)) {
      showToast('Please enter a valid image URL.', 'error');
      return;
    }
    const payload = {
      title: post.title.trim(),
      content: post.content.trim(),
      platforms: post.platforms || [],
      status: post.status || 'draft',
      scheduled_date: post.scheduled_date || null,
      hashtags: post.hashtags || [],
      image_url: (post.image_url || '').trim() || null,
    };

    if (editingPost?.id) {
      const { error } = await supabase.from('social_media_posts').update(payload).eq('id', editingPost.id);
      if (error) { showToast('Failed to update post.', 'error'); return; }
      showToast('Post updated.', 'success');
    } else {
      const { error } = await supabase.from('social_media_posts').insert(payload);
      if (error) { showToast('Failed to create post.', 'error'); return; }
      showToast('Post created.', 'success');
    }
    setShowPostModal(false);
    setEditingPost(null);
    await fetchPosts();
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('social_media_posts').delete().eq('id', id);
    if (error) { showToast('Failed to delete.', 'error'); return; }
    setPosts((p) => p.filter((x) => x.id !== id));
    setPostsTotal((t) => t - 1);
    showToast('Post deleted.', 'success');
  }

  async function markIdeaUsed(id: string, current: boolean) {
    const { error } = await supabase.from('social_media_ideas').update({ used: !current }).eq('id', id);
    if (error) { showToast('Failed to update idea.', 'error'); return; }
    setIdeas((p) => p.map((i) => (i.id === id ? { ...i, used: !current } : i)));
    showToast(current ? 'Marked as unused.' : 'Marked as used.', 'success');
  }

  async function deleteIdea(id: string) {
    if (!confirm('Delete this idea?')) return;
    const { error } = await supabase.from('social_media_ideas').delete().eq('id', id);
    if (error) { showToast('Failed to delete.', 'error'); return; }
    setIdeas((p) => p.filter((x) => x.id !== id));
    setIdeasTotal((t) => t - 1);
    showToast('Idea deleted.', 'success');
  }


  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm shadow-sky-900/50">
                <i className="ri-share-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Social Media</h1>
                <p className="text-xs text-slate-400">Manage posts, schedule content, and track engagement</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {dueCount > 0 && (
                <button
                  onClick={publishDuePosts}
                  disabled={publishingDue}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {publishingDue ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-rocket-line"></i></div>
                  )}
                  Publish {dueCount} Due
                </button>
              )}
              <button
                onClick={() => { fetchPosts(); fetchIdeas(); }}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
              {activeTab === 'posts' ? (
                <button
                  onClick={() => { setEditingPost(null); setShowPostModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                  New Post
                </button>
              ) : (
                <button
                  onClick={() => { setEditingIdea(null); setShowIdeaModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-lightbulb-line"></i></div>
                  New Idea
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-check-double-line text-emerald-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{publishedCount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-medium">Published</p>
            </div>
          </div>
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-calendar-check-line text-blue-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{dueCount}</p>
              <p className="text-xs text-slate-400 font-medium">Due to Publish</p>
            </div>
          </div>
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-heart-line text-pink-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{postsTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-medium">Posts Total</p>
            </div>
          </div>
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-lightbulb-line text-purple-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{ideasTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-medium">Content Ideas</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#0a1628] p-1 rounded-full w-fit border border-[#1a2b4a]">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'posts' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="ri-file-list-3-line mr-1.5"></i>Posts
          </button>
          <button
            onClick={() => setActiveTab('ideas')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'ideas' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="ri-lightbulb-line mr-1.5"></i>Content Ideas
          </button>
        </div>

        {activeTab === 'posts' && (
          <FiltersBarPosts
            search={postsSearch}
            onSearchChange={setPostsSearch}
            platformFilter={postsPlatformFilter}
            onPlatformFilterChange={setPostsPlatformFilter}
            statusFilter={postsStatusFilter}
            onStatusFilterChange={setPostsStatusFilter}
          />
        )}

        {activeTab === 'ideas' && (
          <FiltersBarIdeas
            search={ideasSearch}
            onSearchChange={setIdeasSearch}
            categoryFilter={ideasCategoryFilter}
            onCategoryFilterChange={setIdeasCategoryFilter}
            priorityFilter={ideasPriorityFilter}
            onPriorityFilterChange={setIdeasPriorityFilter}
            usedFilter={ideasUsedFilter}
            onUsedFilterChange={setIdeasUsedFilter}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'posts' ? (
          <div>
            <PostsTable
              posts={posts}
              onEdit={(p) => { setEditingPost(p); setShowPostModal(true); }}
              onDelete={deletePost}
            />
            <Pagination
              currentPage={postsPage}
              totalItems={postsTotal}
              itemsPerPage={POSTS_PER_PAGE}
              onPageChange={setPostsPage}
            />
          </div>
        ) : (
          <div>
            <IdeasGrid
              ideas={ideas}
              onMarkUsed={markIdeaUsed}
              onEdit={(i) => { setEditingIdea(i); setShowIdeaModal(true); }}
              onDelete={deleteIdea}
            />
            <Pagination
              currentPage={ideasPage}
              totalItems={ideasTotal}
              itemsPerPage={IDEAS_PER_PAGE}
              onPageChange={setIdeasPage}
            />
          </div>
        )}
      </div>

      {showPostModal && (
        <PostModal
          post={editingPost}
          onSave={savePost}
          onClose={() => { setShowPostModal(false); setEditingPost(null); }}
          parseHashtags={parseHashtags}
          isValidImageUrl={isValidImageUrl}
        />
      )}

      {showIdeaModal && (
        <IdeaModal
          idea={editingIdea}
          onSave={async (idea) => {
            if (!idea.title?.trim() || !idea.description?.trim()) {
              showToast('Title and description are required.', 'error');
              return;
            }
            const payload = {
              title: idea.title.trim(),
              description: idea.description.trim(),
              category: idea.category || 'general',
              priority: idea.priority || 'medium',
            };
            if (editingIdea?.id) {
              const { error } = await supabase.from('social_media_ideas').update(payload).eq('id', editingIdea.id);
              if (error) { showToast('Failed to update idea.', 'error'); return; }
              showToast('Idea updated.', 'success');
            } else {
              const { error } = await supabase.from('social_media_ideas').insert(payload);
              if (error) { showToast('Failed to create idea.', 'error'); return; }
              showToast('Idea created.', 'success');
            }
            setShowIdeaModal(false);
            setEditingIdea(null);
            await fetchIdeas();
          }}
          onClose={() => { setShowIdeaModal(false); setEditingIdea(null); }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line text-base' : 'ri-error-warning-line text-base'}></i>
          </div>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function FiltersBarPosts({
  search, onSearchChange, platformFilter, onPlatformFilterChange, statusFilter, onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
}) {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="ri-search-line text-slate-500 text-sm"></i>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search posts..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-[#1a2b4a] rounded-xl bg-[#0a1628] text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      <DropdownFilter
        open={platformOpen}
        setOpen={setPlatformOpen}
        label={platformFilter ? platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1) : 'All platforms'}
        options={allPlatforms}
        selected={platformFilter}
        onSelect={(v) => { onPlatformFilterChange(v); setPlatformOpen(false); }}
      />

      <DropdownFilter
        open={statusOpen}
        setOpen={setStatusOpen}
        label={statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'All statuses'}
        options={['draft', 'scheduled', 'published', 'archived']}
        selected={statusFilter}
        onSelect={(v) => { onStatusFilterChange(v); setStatusOpen(false); }}
      />

      {(search || platformFilter || statusFilter) && (
        <button
          onClick={() => { onSearchChange(''); onPlatformFilterChange(''); onStatusFilterChange(''); }}
          className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] rounded-lg cursor-pointer whitespace-nowrap transition"
        >
          <i className="ri-close-line mr-1"></i>Clear
        </button>
      )}
    </div>
  );
}

function FiltersBarIdeas({
  search, onSearchChange, categoryFilter, onCategoryFilterChange, priorityFilter, onPriorityFilterChange, usedFilter, onUsedFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  usedFilter: string;
  onUsedFilterChange: (v: string) => void;
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [usedOpen, setUsedOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="ri-search-line text-slate-500 text-sm"></i>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search ideas..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-[#1a2b4a] rounded-xl bg-[#0a1628] text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      <DropdownFilter
        open={categoryOpen}
        setOpen={setCategoryOpen}
        label={categoryFilter ? ideaCategories.find(c => c.value === categoryFilter)?.label || categoryFilter : 'All categories'}
        options={ideaCategories.map(c => c.value)}
        optionLabels={Object.fromEntries(ideaCategories.map(c => [c.value, c.label]))}
        selected={categoryFilter}
        onSelect={(v) => { onCategoryFilterChange(v); setCategoryOpen(false); }}
      />

      <DropdownFilter
        open={priorityOpen}
        setOpen={setPriorityOpen}
        label={priorityFilter ? priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1) : 'All priorities'}
        options={['low', 'medium', 'high']}
        selected={priorityFilter}
        onSelect={(v) => { onPriorityFilterChange(v); setPriorityOpen(false); }}
      />

      <DropdownFilter
        open={usedOpen}
        setOpen={setUsedOpen}
        label={usedFilter === 'used' ? 'Used' : usedFilter === 'unused' ? 'Unused' : 'All'}
        options={['used', 'unused']}
        selected={usedFilter}
        onSelect={(v) => { onUsedFilterChange(v); setUsedOpen(false); }}
      />

      {(search || categoryFilter || priorityFilter || usedFilter) && (
        <button
          onClick={() => { onSearchChange(''); onCategoryFilterChange(''); onPriorityFilterChange(''); onUsedFilterChange(''); }}
          className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] rounded-lg cursor-pointer whitespace-nowrap transition"
        >
          <i className="ri-close-line mr-1"></i>Clear
        </button>
      )}
    </div>
  );
}

function DropdownFilter({
  open, setOpen, label, options, optionLabels, selected, onSelect,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  label: string;
  options: string[];
  optionLabels?: Record<string, string>;
  selected: string;
  onSelect: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl cursor-pointer whitespace-nowrap transition ${selected ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-[#0a1628] border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a]'}`}
      >
        {label}
        <i className={open ? 'ri-arrow-up-s-line text-xs' : 'ri-arrow-down-s-line text-xs'}></i>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-40 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
          <button
            onClick={() => onSelect('')}
            className={`w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-[#1a2b4a] cursor-pointer whitespace-nowrap ${!selected ? 'text-sky-400 bg-sky-500/5' : ''}`}
          >
            All
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className={`w-full text-left px-3 py-2 text-xs cursor-pointer whitespace-nowrap capitalize ${selected === opt ? 'text-sky-400 bg-sky-500/5' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'}`}
            >
              {optionLabels ? optionLabels[opt] || opt : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PostsTable({ posts, onEdit, onDelete }: { posts: SocialPost[]; onEdit: (p: SocialPost) => void; onDelete: (id: string) => void }) {
  if (posts.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] text-center py-16">
        <div className="w-14 h-14 bg-[#1a2b4a] rounded-full mx-auto mb-4 flex items-center justify-center">
          <i className="ri-share-line text-2xl text-slate-500"></i>
        </div>
        <p className="text-sm text-slate-400 font-medium">No posts found</p>
        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or create a new post</p>
      </div>
    );
  }
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Post</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Platforms</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Status</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">Schedule</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">Engagement</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a2b4a]">
          {posts.map((post) => {
            const s = statusStyles[post.status] || statusStyles.draft;
            return (
              <tr key={post.id} className="hover:bg-[#0a1628]/50 transition">
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-white">{post.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{post.content}</p>
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {post.hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">#{tag}</span>
                      ))}
                      {post.hashtags.length > 3 && (
                        <span className="text-[10px] text-slate-500">+{post.hashtags.length - 3}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {post.platforms.map((pl) => (
                      <span key={pl} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${platformColors[pl] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        <i className={(platformIcons[pl] || 'ri-global-line') + ' text-xs'}></i>
                        {pl}
                      </span>
                    ))}
                    {post.platforms.length === 0 && <span className="text-xs text-slate-500">—</span>}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg} ${s.text}`}>
                    <i className={s.icon}></i>
                    {s.label}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {post.scheduled_date ? (
                    <span className="text-xs text-slate-400">
                      {new Date(post.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <br />
                      <span className="text-slate-500">{new Date(post.scheduled_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span title="Likes"><i className="ri-heart-line text-pink-400"></i> {post.engagement_likes}</span>
                    <span title="Shares"><i className="ri-share-forward-line text-blue-400"></i> {post.engagement_shares}</span>
                    <span title="Comments"><i className="ri-chat-3-line text-amber-400"></i> {post.engagement_comments}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(post)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer" title="Edit"><i className="ri-pencil-line text-sm"></i></button>
                    <button onClick={() => onDelete(post.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition cursor-pointer" title="Delete"><i className="ri-delete-bin-line text-sm"></i></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IdeasGrid({ ideas, onMarkUsed, onEdit, onDelete }: { ideas: SocialIdea[]; onMarkUsed: (id: string, current: boolean) => void; onEdit: (i: SocialIdea) => void; onDelete: (id: string) => void }) {
  if (ideas.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] text-center py-16">
        <div className="w-14 h-14 bg-[#1a2b4a] rounded-full mx-auto mb-4 flex items-center justify-center">
          <i className="ri-lightbulb-line text-2xl text-slate-500"></i>
        </div>
        <p className="text-sm text-slate-400 font-medium">No ideas found</p>
        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or add a new idea</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ideas.map((idea) => {
        const cat = categoryStyles[idea.category] || categoryStyles.general;
        return (
          <div key={idea.id} className={`bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 transition ${idea.used ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${cat.bg} ${cat.text}`}>
                <i className={cat.icon}></i>
                {idea.category}
              </span>
              <div className="flex items-center gap-0.5">
                {idea.priority === 'high' && <span className="w-2 h-2 rounded-full bg-red-400" title="High priority"></span>}
                {idea.priority === 'medium' && <span className="w-2 h-2 rounded-full bg-amber-400" title="Medium priority"></span>}
                <button onClick={() => onEdit(idea)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white cursor-pointer" title="Edit"><i className="ri-pencil-line text-xs"></i></button>
                <button onClick={() => onDelete(idea.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 cursor-pointer" title="Delete"><i className="ri-delete-bin-line text-xs"></i></button>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1.5">{idea.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">{idea.description}</p>
            <div className="flex items-center justify-between pt-3 border-t border-[#1a2b4a]">
              <span className="text-[10px] text-slate-500">
                {new Date(idea.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <button
                onClick={() => onMarkUsed(idea.id, idea.used)}
                className={`text-[11px] font-medium px-3 py-1 rounded-lg cursor-pointer whitespace-nowrap transition ${
                  idea.used
                    ? 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                {idea.used ? 'Unmark' : 'Mark Used'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostModal({ post, onSave, onClose, parseHashtags, isValidImageUrl }: {
  post: SocialPost | null;
  onSave: (p: Partial<SocialPost>) => void;
  onClose: () => void;
  parseHashtags: (input: string) => string[];
  isValidImageUrl: (url: string) => boolean;
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [platforms, setPlatforms] = useState<string[]>(post?.platforms || []);
  const [status, setStatus] = useState(post?.status || 'draft');
  const [scheduledDate, setScheduledDate] = useState(post?.scheduled_date ? post.scheduled_date.slice(0, 16) : '');
  const [hashtagsStr, setHashtagsStr] = useState(post?.hashtags?.map(h => '#' + h).join(', ') || '');
  const [imageUrl, setImageUrl] = useState(post?.image_url || '');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function handleImageUrlChange(val: string) {
    setImageUrl(val);
    if (val.trim() && !isValidImageUrl(val)) {
      setImageError('Enter a valid URL starting with https://');
    } else {
      setImageError('');
    }
  }

  async function handleSave() {
    setSaving(true);
    const hashtags = parseHashtags(hashtagsStr);
    await onSave({
      id: post?.id,
      title,
      content,
      platforms,
      status,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      hashtags,
      image_url: imageUrl || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <h2 className="text-base font-bold text-white">{post ? 'Edit Post' : 'New Post'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500" placeholder="Post title" maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500 min-h-[100px] resize-none" placeholder="Write your post content..." maxLength={2000} />
            <p className="text-xs text-slate-500 mt-1 text-right">{content.length}/2000</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                    platforms.includes(p)
                      ? platformColors[p] + ' border-current'
                      : 'bg-[#0a1628] border-[#1a2b4a] text-slate-500 hover:bg-[#1a2b4a]'
                  }`}
                >
                  <i className={platformIcons[p] || 'ri-global-line'}></i>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Status</label>
              <div className="flex gap-1">
                {(['draft', 'scheduled', 'published'] as const).map((s) => {
                  const st = statusStyles[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                        status === s ? st.bg + ' ' + st.text + ' border-current' : 'bg-[#0a1628] border-[#1a2b4a] text-slate-500 hover:bg-[#1a2b4a]'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Schedule Date</label>
              <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500 [color-scheme:dark]" />
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
            <p className="text-[11px] text-amber-400/80">
              <i className="ri-information-line mr-1"></i>
              Scheduled posts are saved as drafts with a target date. Use the "Publish Due" button in the header to publish all posts whose date has passed, or set up a cron job to call the publish-scheduled-posts edge function on a schedule.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Hashtags</label>
            <input type="text" value={hashtagsStr} onChange={(e) => setHashtagsStr(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500" placeholder="security, eventsafety, quickguard (comma separated)" />
            <p className="text-xs text-slate-500 mt-1">Comma separated. Special characters and # symbols are stripped automatically.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Image URL (optional)</label>
            <input type="text" value={imageUrl} onChange={(e) => handleImageUrlChange(e.target.value)} className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500 ${imageError ? 'border-red-500/50' : 'border-[#1a2b4a]'}`} placeholder="https://..." />
            {imageError && (
              <p className="text-xs text-red-400 mt-1">{imageError}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] rounded-xl transition cursor-pointer whitespace-nowrap">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim() || !!imageError} className="flex items-center gap-2 px-5 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {post ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IdeaModal({ idea, onSave, onClose }: { idea: SocialIdea | null; onSave: (i: Partial<SocialIdea>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(idea?.title || '');
  const [description, setDescription] = useState(idea?.description || '');
  const [category, setCategory] = useState(idea?.category || 'general');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(idea?.priority || 'medium');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ id: idea?.id, title, description, category, priority });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <h2 className="text-base font-bold text-white">{idea ? 'Edit Idea' : 'New Content Idea'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500" placeholder="Idea title" maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500 min-h-[80px] resize-none" placeholder="Describe the content idea..." maxLength={500} />
            <p className="text-xs text-slate-500 mt-1 text-right">{description.length}/500</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {ideaCategories.map((c) => {
                const cat = categoryStyles[c.value] || categoryStyles.general;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                      category === c.value ? cat.bg + ' ' + cat.text + ' border-current' : 'bg-[#0a1628] border-[#1a2b4a] text-slate-500 hover:bg-[#1a2b4a]'
                    }`}
                  >
                    <i className={cat.icon}></i>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                    priority === p
                      ? p === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : p === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      : 'bg-[#0a1628] border-[#1a2b4a] text-slate-500 hover:bg-[#1a2b4a]'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] rounded-xl transition cursor-pointer whitespace-nowrap">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !description.trim()} className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {idea ? 'Save Changes' : 'Add Idea'}
          </button>
        </div>
      </div>
    </div>
  );
}