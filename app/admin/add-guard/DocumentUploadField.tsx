'use client';

import { useRef, useState } from 'react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

interface DocumentUploadFieldProps {
  label: string;
  description?: string;
  value: { base64: string; name: string; type: string } | null;
  onChange: (file: { base64: string; name: string; type: string } | null) => void;
  error?: string;
}

function fileIcon(mime: string): string {
  if (mime === 'application/pdf') return 'ri-file-pdf-line';
  if (mime.startsWith('image/')) return 'ri-image-line';
  return 'ri-file-line';
}

export default function DocumentUploadField({ label, description, value, onChange, error }: DocumentUploadFieldProps) {
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
      onChange({ base64: reader.result as string, name: file.name, type: file.type });
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
        <div className="flex items-center gap-3 bg-[#0a1628] border border-[#1a2b4a] rounded-lg px-4 py-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={`${fileIcon(value.type)} text-teal-400 text-lg`}></i>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{value.name}</p>
            <p className="text-xs text-slate-500">{value.type}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-8 h-8 rounded-lg hover:bg-[#1a2b4a] flex items-center justify-center transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line text-slate-400 text-sm"></i>
              </div>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-delete-bin-line text-red-400 text-sm"></i>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors ${
            dragOver
              ? 'border-teal-500 bg-teal-500/5'
              : 'border-[#1a2b4a] hover:border-slate-500 bg-[#0a1628]'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-[#1a2b4a] flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-upload-cloud-2-line text-slate-400"></i>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400">Click or drag to upload</p>
            <p className="text-xs text-slate-600">JPEG, PNG, WebP, PDF &middot; Max 10MB</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}