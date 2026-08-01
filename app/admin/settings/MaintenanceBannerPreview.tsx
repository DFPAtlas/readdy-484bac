'use client';

import { useState } from 'react';

interface Props {
  message?: string;
}

export default function MaintenanceBannerPreview({ message }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const isDark = theme === 'dark';
  const displayMessage = message || '';

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0B1933] border-slate-800' : 'bg-white border-slate-200'
    }`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-300 ${
        isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
      }`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Live Preview
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            isDark ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100 border border-slate-200'
          }`}>
            Visitors will see this
          </span>
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} />
          </button>
        </div>
      </div>
      <div className="p-8 md:p-10 flex flex-col items-center text-center">
        <div className={`w-16 h-16 border rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${
          isDark ? 'bg-teal-500/10 border-teal-400/20' : 'bg-teal-50 border-teal-200'
        }`}>
          <div className="w-8 h-8 flex items-center justify-center">
            <i className={`ri-tools-line text-2xl ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
        </div>

        <h2 className={`text-2xl md:text-3xl font-bold mb-3 transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          We'll be back soon
        </h2>
        <p className={`text-base mb-6 max-w-md leading-relaxed transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {displayMessage || "QuickGuard is currently undergoing scheduled maintenance. We're making things better and will be back online shortly."}
        </p>

        <div className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full mb-8 transition-colors duration-300 ${
          isDark ? 'bg-teal-500/10 border-teal-400/20 text-teal-400' : 'bg-teal-50 border-teal-200 text-teal-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-teal-400' : 'bg-teal-500'}`} />
          <span className="font-medium text-sm">Maintenance in progress</span>
        </div>

        <div className={`pt-5 w-full max-w-xs transition-colors duration-300 ${isDark ? 'border-t border-slate-800' : 'border-t border-slate-200'}`}>
          <p className={`text-xs mb-2 transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Need urgent assistance?
          </p>
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-300 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-mail-line text-xs" />
            </div>
            info@quickguard.uk
          </span>
        </div>
      </div>
    </div>
  );
}