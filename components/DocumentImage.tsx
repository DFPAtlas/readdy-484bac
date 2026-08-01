'use client';

import { useState, useEffect } from 'react';
import { getDocumentSignedUrl } from '@/lib/supabase-storage';

interface DocumentImageProps {
  path: string | null;
  label: string;
  className?: string;
}

export default function DocumentImage({ path, label, className = '' }: DocumentImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    async function loadSignedUrl() {
      setLoading(true);
      setError(false);
      try {
        const url = await getDocumentSignedUrl(path as string, 3600);
        if (!cancelled) setSignedUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSignedUrl();
    return () => { cancelled = true; };
  }, [path]);

  if (!path) return null;

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center min-h-[120px] ${className}`} aria-busy="true" aria-label={`Loading ${label || 'document'}`}>
        <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`bg-red-50 rounded-lg p-4 min-h-[120px] flex flex-col items-center justify-center text-center ${className}`} role="alert">
        <i className="ri-error-warning-line text-red-500 text-xl mb-1"></i>
        <p className="text-xs text-red-600 font-medium mb-1">Failed to load document</p>
        <p className="text-[10px] text-red-400 break-all px-2">Path: {path}</p>
      </div>
    );
  }

  const isPdf = path.toLowerCase().endsWith('.pdf');
  const fileName = path.split('/').pop() || 'document';

  if (isPdf) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg">
            <i className="ri-file-pdf-line text-red-600 text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{label || 'PDF Document'}</p>
            <p className="text-xs text-gray-500">PDF Document</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${label || 'PDF'} in new tab`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-eye-line"></i>
            View PDF
          </a>
          <a
            href={signedUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download ${label || 'PDF'}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-download-2-line"></i>
            Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg overflow-hidden ${className}`}>
      {label && <p className="text-sm font-medium text-gray-700 px-3 pt-3 mb-2">{label}</p>}
      <img
        src={signedUrl}
        alt={label || 'Uploaded document'}
        className="w-full h-auto object-contain max-h-[300px] cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setEnlarged(true)}
      />
      <div className="flex flex-wrap gap-2 p-3">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${label || 'image'} full size in new tab`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-external-link-line"></i>
          Open full size
        </a>
        <a
          href={signedUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${label || 'image'}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-download-2-line"></i>
          Download
        </a>
      </div>
      {enlarged && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEnlarged(false)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <img src={signedUrl} alt={label || 'Uploaded document'} className="max-w-full max-h-[85vh] object-contain" />
            <button
              aria-label="Close preview"
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
              onClick={() => setEnlarged(false)}
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}