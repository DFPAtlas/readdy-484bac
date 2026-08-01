'use client';

import { useRef, useState } from 'react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value: { base64: string; name: string } | null;
  onChange: (file: { base64: string; name: string } | null) => void;
  error?: string;
  recommendedSize?: string;
}

export default function ImageUploadField({ label, description, value, onChange, error, recommendedSize }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onChange(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      onChange(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ base64: reader.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {description && <p className="text-xs text-slate-500 mb-2">{description}</p>}

      {value ? (
        <div className="relative inline-block group">
          <img
            src={value.base64}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border border-[#1a2b4a]"
          />
          <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center hover:bg-teal-500/40 transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line text-teal-400 text-sm"></i>
              </div>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center hover:bg-red-500/40 transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-delete-bin-line text-red-400 text-sm"></i>
              </div>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate max-w-[128px]">{value.name}</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            dragOver
              ? 'border-teal-500 bg-teal-500/5'
              : 'border-[#1a2b4a] hover:border-slate-500 bg-[#0a1628]'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-image-add-line text-slate-500 text-lg"></i>
          </div>
          <span className="text-xs text-slate-500">Upload</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {recommendedSize && !value && (
        <p className="text-xs text-slate-600 mt-1">{recommendedSize}</p>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}