'use client';

import { useState, useEffect } from 'react';
import { getSIALicenceSignedUrl } from '@/lib/supabase-storage';
import { supabase } from '@/lib/supabase';

interface DocumentThumbnailProps {
  path: string | null;
  label: string;
  bucket: 'sia-licences' | 'guard-profiles';
}

export default function DocumentThumbnail({ path, label, bucket }: DocumentThumbnailProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    async function loadSignedUrl() {
      setLoading(true);
      try {
        let url: string;
        if (bucket === 'sia-licences') {
          url = await getSIALicenceSignedUrl(path, 3600);
        } else {
          const { data, error } = await supabase.storage
            .from('guard-profiles')
            .createSignedUrl(path, 3600);
          if (error) throw error;
          url = data.signedUrl;
        }
        if (!cancelled) setSignedUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSignedUrl();
    return () => { cancelled = true; };
  }, [path, bucket]);

  if (!path) return null;

  const isPdf = path.toLowerCase().endsWith('.pdf');

  return (
    <>
      <button
        onClick={() => {
          if (!loading && !error && signedUrl && !isPdf) setEnlarged(true);
          if (signedUrl && isPdf) window.open(signedUrl, '_blank');
        }}
        className="relative group rounded-lg overflow-hidden border border-[#1a2b4a] bg-[#0B1933] hover:border-slate-500 transition-all cursor-pointer flex-shrink-0 w-[100px] h-[72px]"
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error || !signedUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
            <div className="w-4 h-4 flex items-center justify-center text-slate-500">
              <i className="ri-image-line text-sm"></i>
            </div>
            <span className="text-[9px] text-slate-500 font-medium leading-tight text-center">{label}</span>
          </div>
        ) : isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-red-500/10">
              <i className="ri-file-pdf-line text-red-400 text-base"></i>
            </div>
            <span className="text-[9px] text-slate-400 font-medium leading-tight text-center">PDF</span>
          </div>
        ) : (
          <img
            src={signedUrl}
            alt={label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] text-white font-semibold">{label}</span>
        </div>
      </button>

      {enlarged && signedUrl && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setEnlarged(false)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={signedUrl} alt={label} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
              onClick={() => setEnlarged(false)}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-close-line text-xl"></i>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}