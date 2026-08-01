
'use client';

import { useState, useRef, useEffect } from 'react';

interface ShareJobButtonProps {
  jobId: string;
  jobTitle: string;
  location: string;
}

export default function ShareJobButton({ jobId, jobTitle, location }: ShareJobButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const jobUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/jobs/${jobId}`
    : `/jobs/${jobId}`;

  const shareText = `Check out this security job: ${jobTitle} in ${location}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(jobUrl).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 2000);
    });
  };

  const shareLinks = [
    {
      label: 'Share on LinkedIn',
      icon: 'ri-linkedin-fill',
      color: 'text-blue-700',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`,
    },
    {
      label: 'Share on X (Twitter)',
      icon: 'ri-twitter-x-fill',
      color: 'text-gray-900',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(jobUrl)}`,
    },
    {
      label: 'Share on WhatsApp',
      icon: 'ri-whatsapp-fill',
      color: 'text-green-600',
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + jobUrl)}`,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
        aria-label="Share this job"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-share-line text-sm"></i>
        </div>
        Share
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Share this job</p>
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={`text-base ${copied ? 'ri-checkbox-circle-fill text-green-600' : 'ri-links-line text-gray-500'}`}></i>
            </div>
            <span className={`text-sm font-medium ${copied ? 'text-green-600' : 'text-gray-700'}`}>
              {copied ? 'Link Copied!' : 'Copy Link'}
            </span>
          </button>

          {shareLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${item.icon} text-base ${item.color}`}></i>
              </div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
