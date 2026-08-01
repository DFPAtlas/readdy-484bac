'use client';

import { useState } from 'react';

interface AccountsTabsProps {
  activeTab: 'clients' | 'guards';
  onTabChange: (tab: 'clients' | 'guards') => void;
  clientCount: number;
  guardCount: number;
}

export default function AccountsTabs({ activeTab, onTabChange, clientCount, guardCount }: AccountsTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-[#0a1628] p-1 rounded-full w-fit ring-1 ring-[#1a2b4a]">
      <button
        onClick={() => onTabChange('clients')}
        className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
          activeTab === 'clients'
            ? 'bg-teal-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-building-line"></i>
        </div>
        Clients
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          activeTab === 'clients' ? 'bg-teal-500/20 text-teal-100' : 'bg-[#1a2b4a] text-slate-400'
        }`}>
          {clientCount}
        </span>
      </button>
      <button
        onClick={() => onTabChange('guards')}
        className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
          activeTab === 'guards'
            ? 'bg-teal-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-shield-user-line"></i>
        </div>
        Guards
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          activeTab === 'guards' ? 'bg-teal-500/20 text-teal-100' : 'bg-[#1a2b4a] text-slate-400'
        }`}>
          {guardCount}
        </span>
      </button>
    </div>
  );
}
