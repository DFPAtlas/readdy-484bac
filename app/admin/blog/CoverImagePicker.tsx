'use client';

import { useState } from 'react';
import { BLOG_COVER_OPTIONS } from '@/lib/blog-covers';
import CoverImageModal from './CoverImageModal';

interface CoverImagePickerProps {
  value: string;
  onChange: (url: string) => void;
}

export default function CoverImagePicker({ value, onChange }: CoverImagePickerProps) {
  const [open, setOpen] = useState(false);
  const chosen = BLOG_COVER_OPTIONS.find((option) => option.url === value);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-semibold text-slate-400">Cover image</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-400 transition cursor-pointer whitespace-nowrap"
          >
            <span className="w-3 h-3 flex items-center justify-center"><i className="ri-delete-bin-line text-[11px]" /></span>
            Remove
          </button>
        )}
      </div>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-[#1a2b4a] group">
          <img src={value} alt="Cover preview" className="w-full aspect-[16/9] object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1933]/95 via-[#0B1933]/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-2.5">
            <span className="text-[11px] font-medium text-slate-300 truncate">
              {chosen ? chosen.label : 'Custom image'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-image-edit-line text-[11px]" /></span>
              Change image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border-2 border-dashed border-[#1a2b4a] bg-[#0e1628] hover:border-teal-500/50 transition px-4 py-8 text-center cursor-pointer"
        >
          <span className="w-10 h-10 mx-auto mb-2 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 flex items-center justify-center text-teal-400">
            <i className="ri-image-add-line text-lg" />
          </span>
          <span className="block text-sm font-medium text-white">Choose a cover image</span>
          <span className="block text-xs text-slate-500 mt-1">Pick from the gallery or upload your own</span>
        </button>
      )}

      {open && (
        <CoverImageModal
          current={value}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}