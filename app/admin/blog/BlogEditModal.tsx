'use client';

import { useEffect, useState } from 'react';
import { slugify, type BlogAudience, type BlogPost } from '@/lib/blog';
import MarkdownBody from '@/components/blog/MarkdownBody';
import CoverImagePicker from './CoverImagePicker';
import BlogCardPreview from './BlogCardPreview';

interface BlogEditModalProps {
  post: BlogPost | null;
  onClose: () => void;
  onSave: (values: Partial<BlogPost>) => Promise<boolean>;
}

const AUDIENCES: { key: BlogAudience; label: string }[] = [
  { key: 'both', label: 'Everyone' },
  { key: 'client', label: 'Clients' },
  { key: 'guard', label: 'Guards' },
];

const inputClass =
  'w-full box-border bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500/60 transition-colors';

export default function BlogEditModal({ post, onClose, onSave }: BlogEditModalProps) {
  const isNew = !post;
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState(post?.content || '');
  const [coverImage, setCoverImage] = useState(post?.cover_image_url || '');
  const [audience, setAudience] = useState<BlogAudience>((post?.audience as BlogAudience) || 'both');
  const [tags, setTags] = useState((post?.tags || []).join(', '));
  const [metaTitle, setMetaTitle] = useState(post?.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description || '');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('A title is required before saving.');
      return;
    }

    const finalSlug = slugify(slug || title);
    if (!finalSlug) {
      setError('Please provide a valid slug.');
      return;
    }

    setSaving(true);
    const ok = await onSave({
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim() || null,
      content,
      cover_image_url: coverImage.trim() || null,
      audience,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      meta_title: metaTitle.trim() || null,
      meta_description: metaDescription.trim() || null,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl bg-[#0B1933] border border-[#1a2b4a] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1a2b4a] bg-[#111d35]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 flex items-center justify-center text-teal-400">
              <i className={isNew ? 'ri-quill-pen-line text-sm' : 'ri-edit-line text-sm'} />
            </span>
            <p className="text-sm font-semibold text-white truncate">{isNew ? 'Write a new post' : 'Edit post'}</p>
            <span className="text-[11px] font-medium text-slate-400 bg-[#0B1933] border border-[#1a2b4a] px-2 py-0.5 rounded-full whitespace-nowrap">
              {isNew ? 'Saves as draft' : 'Manual'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label htmlFor="post-title" className="block text-xs font-semibold text-slate-400 mb-1.5">Title</label>
              <input
                id="post-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                placeholder="e.g. How to brief a guard before a shift"
                autoFocus
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="post-slug" className="block text-xs font-semibold text-slate-400 mb-1.5">Slug</label>
              <div className="flex gap-2">
                <input id="post-slug" value={slug} onChange={(event) => setSlug(event.target.value)} className={inputClass} placeholder="auto from title" />
                <button
                  type="button"
                  onClick={() => setSlug(slugify(title))}
                  className="px-3 py-2 text-xs font-medium text-slate-300 bg-[#111d35] border border-[#1a2b4a] rounded-lg hover:text-white whitespace-nowrap cursor-pointer"
                >
                  From title
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="post-excerpt" className="block text-xs font-semibold text-slate-400 mb-1.5">Excerpt</label>
            <textarea
              id="post-excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value.slice(0, 300))}
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder="One or two sentences shown on the blog listing."
            />
            <p className="text-[11px] text-slate-600 mt-1">{excerpt.length}/300</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0 space-y-4">
              <CoverImagePicker value={coverImage} onChange={setCoverImage} />
              <BlogCardPreview
                title={title}
                excerpt={excerpt}
                content={content}
                coverImage={coverImage}
                audience={audience}
                tags={tags.split(',').map((tag) => tag.trim()).filter(Boolean)}
                dateValue={post?.published_at || post?.created_at || null}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <div className="min-w-0">
                <label htmlFor="post-tags" className="block text-xs font-semibold text-slate-400 mb-1.5">Tags</label>
                <input id="post-tags" value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} placeholder="compliance, SIA" />
                <p className="text-[11px] text-slate-600 mt-1">Separate tags with commas.</p>
              </div>

              <div className="min-w-0">
                <span className="block text-xs font-semibold text-slate-400 mb-1.5">Audience</span>
                <div className="inline-flex items-center gap-1 p-1 bg-[#111d35] border border-[#1a2b4a] rounded-full">
                  {AUDIENCES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setAudience(item.key)}
                      aria-pressed={audience === item.key}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        audience === item.key ? 'bg-teal-500 text-slate-900' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1.5 gap-3">
              <span className="text-xs font-semibold text-slate-400">Content (markdown)</span>
              <div className="inline-flex items-center gap-1 p-0.5 bg-[#111d35] border border-[#1a2b4a] rounded-full">
                {(['write', 'preview'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition cursor-pointer whitespace-nowrap ${
                      mode === item ? 'bg-teal-500/20 text-teal-300' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'write' ? (
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={14}
                className={`${inputClass} font-mono text-[13px] leading-relaxed`}
                placeholder="## Heading&#10;&#10;Paragraph text…"
              />
            ) : (
              <div className="border border-[#1a2b4a] bg-[#0e1628] rounded-lg p-4 max-h-[420px] overflow-y-auto">
                {content.trim() ? <MarkdownBody content={content} /> : (
                  <p className="text-sm text-slate-500">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label htmlFor="post-meta-title" className="block text-xs font-semibold text-slate-400 mb-1.5">Meta title</label>
              <input id="post-meta-title" value={metaTitle} onChange={(event) => setMetaTitle(event.target.value.slice(0, 70))} className={inputClass} placeholder="Defaults to the title" />
              <p className="text-[11px] text-slate-600 mt-1">{metaTitle.length}/70</p>
            </div>
            <div className="min-w-0">
              <label htmlFor="post-meta-description" className="block text-xs font-semibold text-slate-400 mb-1.5">Meta description</label>
              <textarea
                id="post-meta-description"
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value.slice(0, 160))}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Defaults to the excerpt"
              />
              <p className="text-[11px] text-slate-600 mt-1">{metaDescription.length}/160</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-error-warning-line" /></span>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[#1a2b4a] bg-[#111d35]">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {isNew ? 'Created as a draft — publish it once you are happy.' : 'Changes save straight to this post.'}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line" /></span>
              )}
              {isNew ? 'Create draft' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}