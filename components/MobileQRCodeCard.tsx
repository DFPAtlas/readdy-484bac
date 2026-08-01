"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface MobileQRCodeCardProps {
  mobileUrl: string;
  label?: string;
  accentColor?: string;
}

export default function MobileQRCodeCard({ mobileUrl, label = "View on Mobile", accentColor = "teal" }: MobileQRCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [fullUrl, setFullUrl] = useState(mobileUrl);
  const path = mobileUrl.replace(/^https?:\/\/[^\/]+/, '');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFullUrl(window.location.origin + path);
    }
  }, [path]);

  if (isMobile) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(fullUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center">
          <i className="ri-smartphone-line text-teal-400"></i>
        </div>
        <h3 className="text-sm font-semibold text-white">{label}</h3>
      </div>

      <div className="flex items-center gap-4">
        <img
          src={qrUrl}
          alt="QR code to mobile dashboard"
          className="w-20 h-20 rounded-lg border border-[#1a2b4a] bg-white p-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-2">Scan to open on your phone</p>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 bg-[#0B1933] border border-[#1a2b4a] text-slate-300 text-xs font-medium py-2 rounded-lg hover:bg-[#162036] hover:border-[#2a3e5f] transition-all cursor-pointer whitespace-nowrap"
          >
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <i className={copied ? 'ri-check-line text-emerald-400' : 'ri-link text-slate-500'}></i>
            </div>
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}