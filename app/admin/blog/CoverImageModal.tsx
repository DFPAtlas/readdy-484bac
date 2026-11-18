'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ALLOWED_COVER_TYPES,
  BLOG_COVER_OPTIONS,
  MAX_COVER_BYTES,
  uploadBlogCover,
} from '@/lib/blog-covers';

interface CoverImageModalProps {
  current: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

const COVER_URL_PATTERN = /^https?:\/\/\S+$/i;

export default function CoverImageModal({ current, onSelect, onClose }: CoverImageModalProps) {
  const [tab, setTab] = useState<'gallery' | 'upload'>('gallery');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleFile(file: File) {
    setError('');
    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setError('Please use a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('That file is larger than 5MB. Please choose a smaller image.');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadBlogCover(file);
      onSelect(url);
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function applyLink() {
    const trimmed = link.trim();
    if (!COVER_URL_PATTERN.test(trimmed)) {
      setError('Enter a full image link starting with https://');
      return;
    }
    setError('');
    onSelect(trimmed);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#0B1933] border border-[#1a2b4a] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1a2b4a] bg-[#111d35]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 flex items-center justify-center text-teal-400">
              <i className="ri-image-line text-sm" />
            </span>
            <p className="text-sm font-semibold text-white truncate">Choose a cover image</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image picker"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#1a2b4a] flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-[#111d35] border border-[#1a2b4a] rounded-full">
            {([
              { key: 'gallery' as const, label: 'Gallery', icon: 'ri-layout-grid-line' },
              { key: 'upload' as const, label: 'Upload', icon: 'ri-upload-cloud-line' },
            ]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setTab(item.key); setError(''); }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  tab === item.key ? 'bg-teal-500 text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${item.icon} text-[11px]`} /></span>
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Landscape images work best — 1200 × 675.</p>
        </div>

        <div className="p-5 max-h-[62vh] overflow-y-auto">
          {tab === 'gallery' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BLOG_COVER_OPTIONS.map((option) => {
                const active = current === option.url;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => { onSelect(option.url); onClose(); }}
                    className={`group relative rounded-xl overflow-hidden border text-left transition cursor-pointer ${
                      active ? 'border-teal-400 ring-2 ring-teal-500/40' : 'border-[#1a2b4a] hover:border-teal-500/50'
                    }`}
                  >
                    <img
                      src={option.url}
                      alt={option.label}
                      className="w-full aspect-video object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B1933] via-[#0B1933]/70 to-transparent px-2.5 pt-6 pb-2 text-[11px] font-medium text-white">
                      {option.label}
                    </span>
                    {active && (
                      <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-teal-500 text-slate-900">
                        <i className="ri-check-line text-xs" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file && !uploading) handleFile(file);
                }}
                onClick={() => { if (!uploading) inputRef.current?.click(); }}
                className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition cursor-pointer ${
                  dragOver ? 'border-teal-400 bg-teal-500/5' : 'border-[#1a2b4a] bg-[#0e1628] hover:border-teal-500/50'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <span className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Uploading your image…</p>
                  </div>
                ) : (
                  <>
                    <span className="w-11 h-11 mx-auto mb-3 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex items-center justify-center text-teal-400">
                      <i className="ri-upload-cloud-2-line text-xl" />
                    </span>
                    <p className="text-sm font-medium text-white">Drop an image here or click to browse</p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG or WebP · up to 5MB</p>
                  </>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                  event.target.value = '';
                }}
              />

              <div>
                <label htmlFor="cover-link" className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Or paste an image link
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="cover-link"
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder="https://…"
                    className="flex-1 min-w-0 box-border bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={applyLink}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap"
                  >
                    Use link
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-400 flex items-start gap-2">
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-error-warning-line" /></span>
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}