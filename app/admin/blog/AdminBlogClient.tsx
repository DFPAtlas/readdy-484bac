'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminPageShell from '@/components/admin/AdminPageShell';
import type { BlogPost } from '@/lib/blog';
import BlogPostList from './BlogPostList';
import BlogEditModal from './BlogEditModal';
import BlogPreviewModal from './BlogPreviewModal';
import NewsletterPanel from './NewsletterPanel';

type TabKey = 'draft' | 'published' | 'rejected' | 'newsletter';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'draft', label: 'Drafts', icon: 'ri-draft-line' },
  { key: 'published', label: 'Published', icon: 'ri-checkbox-circle-line' },
  { key: 'rejected', label: 'Rejected', icon: 'ri-close-circle-line' },
  { key: 'newsletter', label: 'Newsletter', icon: 'ri-mail-send-line' },
];

export default function AdminBlogClient() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('draft');
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewing, setPreviewing] = useState<BlogPost | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, cover_image_url, audience, tags, status, source, meta_title, meta_description, published_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Could not load posts. Please refresh.', 'error');
      setPosts([]);
    } else {
      setPosts((data as BlogPost[]) || []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const counts = useMemo(() => ({
    draft: posts.filter((post) => post.status === 'draft' || post.status === 'approved').length,
    published: posts.filter((post) => post.status === 'published').length,
    rejected: posts.filter((post) => post.status === 'rejected').length,
  }), [posts]);

  const visiblePosts = useMemo(() => {
    if (tab === 'newsletter') return [];
    if (tab === 'draft') return posts.filter((post) => post.status === 'draft' || post.status === 'approved');
    return posts.filter((post) => post.status === tab);
  }, [posts, tab]);

  async function updateStatus(post: BlogPost, next: 'published' | 'rejected' | 'draft') {
    if (next === 'published' && !post.content.trim()) {
      showToast('Add some content before publishing this post.', 'error');
      return;
    }

    setBusyId(post.id);
    const payload: Record<string, unknown> = {
      status: next,
      updated_at: new Date().toISOString(),
      published_at: next === 'published' ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from('blog_posts').update(payload).eq('id', post.id);
    setBusyId(null);

    if (error) {
      showToast('Update failed. Please try again.', 'error');
      return;
    }

    setPosts((prev) => prev.map((item) => (item.id === post.id ? { ...item, ...payload } as BlogPost : item)));
    const messages: Record<string, string> = {
      published: 'Post approved and published.',
      rejected: 'Post rejected.',
      draft: 'Post unpublished and returned to drafts.',
    };
    showToast(messages[next], 'success');
  }

  async function handleSave(values: Partial<BlogPost>) {
    if (!editing) {
      const payload = {
        ...values,
        status: 'draft' as const,
        source: 'manual',
        published_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('blog_posts')
        .insert(payload)
        .select('id, title, slug, excerpt, content, cover_image_url, audience, tags, status, source, meta_title, meta_description, published_at, created_at, updated_at')
        .maybeSingle();

      if (error || !data) {
        if (error?.code === '23505') {
          showToast('That slug is already used by another post.', 'error');
        } else {
          showToast('Could not create the post. Please try again.', 'error');
        }
        return false;
      }

      setPosts((prev) => [data as BlogPost, ...prev]);
      setTab('draft');
      showToast('New post created as a draft.', 'success');
      return true;
    }

    const payload = { ...values, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('blog_posts').update(payload).eq('id', editing.id);

    if (error) {
      if (error.code === '23505') {
        showToast('That slug is already used by another post.', 'error');
      } else {
        showToast('Save failed. Please try again.', 'error');
      }
      return false;
    }

    setPosts((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...payload } as BlogPost : item)));
    showToast('Post saved.', 'success');
    return true;
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditing(post);
    setEditorOpen(true);
  }

  return (
    <AdminPageShell
      title="Blog & Newsletter"
      eyebrow="Communications"
      description="Review AI-generated drafts, write your own posts, approve them for the public blog and manage newsletter subscribers."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-quill-pen-line" /></span>
            New post
          </button>
          <button
            onClick={() => fetchPosts()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 bg-[#0B1933] border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line" /></span>
            Refresh
          </button>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((item) => {
            const active = tab === item.key;
            const count = item.key === 'newsletter' ? null : counts[item.key];
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center"><i className={`${item.icon} text-sm`} /></span>
                {item.label}
                {count !== null && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums ${
                    active ? 'bg-teal-500/20 text-teal-200' : 'bg-[#1a2b4a] text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      }
    >
      {tab === 'newsletter' ? (
        <NewsletterPanel onToast={showToast} />
      ) : (
        <BlogPostList
          posts={visiblePosts}
          loading={loading}
          tab={tab}
          busyId={busyId}
          onCreate={openCreate}
          onPreview={setPreviewing}
          onEdit={openEdit}
          onApprove={(post) => updateStatus(post, 'published')}
          onReject={(post) => updateStatus(post, 'rejected')}
          onUnpublish={(post) => updateStatus(post, 'draft')}
        />
      )}

      {previewing && (
        <BlogPreviewModal post={previewing} onClose={() => setPreviewing(null)} />
      )}

      {editorOpen && (
        <BlogEditModal
          post={editing}
          onClose={() => setEditorOpen(false)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[90] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <span className="w-5 h-5 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line text-base' : 'ri-error-warning-line text-base'} />
          </span>
          {toast.message}
        </div>
      )}
    </AdminPageShell>
  );
}