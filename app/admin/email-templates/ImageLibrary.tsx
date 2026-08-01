'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface EmailAsset {
  id: string;
  file_name: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

interface ImageLibraryProps {
  onInsertImage: (url: string) => void;
}

export default function ImageLibrary({ onInsertImage }: ImageLibraryProps) {
  const [assets, setAssets] = useState<EmailAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const getCurrentUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Only image files (PNG, JPEG, WebP, SVG) are allowed', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('File size must be under 2MB', 'error');
      return;
    }

    setUploading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const ext = file.name.split('.').pop() || 'png';
      const randomName = crypto.randomUUID() + '.' + ext;
      const filePath = `email-assets/${year}/${month}/${randomName}`;

      const { error: uploadError } = await supabase.storage
        .from('quickguard-email-assets')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('quickguard-email-assets')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const userId = await getCurrentUserId();

      const { error: insertError } = await supabase
        .from('email_assets')
        .insert({
          file_name: file.name,
          file_path: filePath,
          public_url: publicUrl,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
        });

      if (insertError) throw insertError;

      showToast('Image uploaded successfully');
      fetchAssets();
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: EmailAsset) => {
    if (deletingId === asset.id) {
      try {
        await supabase.storage
          .from('quickguard-email-assets')
          .remove([asset.file_path]);
      } catch {}

      try {
        const { error } = await supabase
          .from('email_assets')
          .delete()
          .eq('id', asset.id);
        if (error) throw error;
        showToast('Image deleted');
        fetchAssets();
      } catch (err: any) {
        showToast(err.message || 'Delete failed', 'error');
      } finally {
        setDeletingId(null);
      }
    } else {
      setDeletingId(asset.id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const handleInsert = (asset: EmailAsset) => {
    const imgHtml = `<img src="${asset.public_url}" alt="QuickGuard image" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;margin:0 auto;" />`;
    onInsertImage(imgHtml);
    showToast('Image inserted into template');
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatMime = (mime: string) => {
    const map: Record<string, string> = {
      'image/png': 'PNG',
      'image/jpeg': 'JPEG',
      'image/webp': 'WebP',
      'image/svg+xml': 'SVG',
    };
    return map[mime] || mime;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm">Loading image library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-teal-400 bg-teal-500/10'
            : 'border-[#1e2d4a] bg-[#111d35] hover:border-teal-500/30 hover:bg-teal-500/5'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-300">Uploading image...</p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 flex items-center justify-center bg-teal-500/15 rounded-full mx-auto mb-4">
              <i className="ri-image-add-line text-2xl text-teal-400"></i>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Upload Image</h3>
            <p className="text-sm text-slate-400 mb-3">
              Drag & drop an image here, or click to browse
            </p>
            <p className="text-xs text-slate-500">
              PNG, JPEG, WebP, SVG \u00b7 Max 2MB
            </p>
          </>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-16 text-center">
          <div className="w-16 h-16 flex items-center justify-center bg-slate-500/10 rounded-full mx-auto mb-4">
            <i className="ri-image-line text-3xl text-slate-500"></i>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No images yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Upload your branded email images here. You can then insert them into any email template.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-[#111d35] rounded-xl border border-[#1e2d4a] overflow-hidden hover:border-teal-500/30 hover:shadow-lg transition-all group"
            >
              <div className="aspect-video bg-[#0a1628] flex items-center justify-center overflow-hidden">
                <img
                  src={asset.public_url}
                  alt={asset.file_name}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="p-3 border-t border-[#1e2d4a]">
                <p className="text-xs font-medium text-slate-300 truncate mb-1" title={asset.file_name}>
                  {asset.file_name}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span className="px-1.5 py-0.5 bg-[#0a1628] rounded text-[10px] font-medium">
                    {formatMime(asset.mime_type || '')}
                  </span>
                  <span>{formatSize(asset.size_bytes || 0)}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyUrl(asset.public_url, asset.id); }}
                    className="px-2 py-1 text-[10px] font-medium rounded-md bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 transition-colors whitespace-nowrap flex items-center gap-1"
                    title="Copy URL"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className={copiedId === asset.id ? 'ri-check-line text-emerald-400' : 'ri-file-copy-line'}></i>
                    </div>
                    {copiedId === asset.id ? 'Copied' : 'URL'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleInsert(asset); }}
                    className="px-2 py-1 text-[10px] font-medium rounded-md bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 transition-colors whitespace-nowrap flex items-center gap-1"
                    title="Insert into template"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-insert-row-top"></i>
                    </div>
                    Insert
                  </button>
                  {deletingId === asset.id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                      className="px-2 py-1 text-[10px] font-medium rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(asset.id); setTimeout(() => setDeletingId(null), 3000); }}
                      className="w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-red-400 hover:text-red-300 transition-all"
                      title="Delete"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-delete-bin-line"></i>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}