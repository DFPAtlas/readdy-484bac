'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/loftlog', label: 'Dashboard', icon: 'ri-dashboard-line' },
  { href: '/loftlog/items', label: 'Items', icon: 'ri-archive-line' },
  { href: '/loftlog/items/add', label: 'Add Item', icon: 'ri-add-box-line' },
  { href: '/loftlog/items/add/mobile', label: 'Quick Add', icon: 'ri-smartphone-line' },
  { href: '/loftlog/clearout', label: 'Items to Clear', icon: 'ri-delete-back-line' },
  { href: '/loftlog/ai-assistant', label: 'AI Assistant', icon: 'ri-robot-line' },
  { href: '/loftlog/ai-review', label: 'AI Review Queue', icon: 'ri-sparkling-line' },
  { href: '/loftlog/management', label: 'Management', icon: 'ri-settings-3-line' },
];

const workspaceItems = [
  { href: '/loftlog/management/inventory', label: 'Inventory', icon: 'ri-stack-line' },
  { href: '/loftlog/management/storage', label: 'Storage Planning', icon: 'ri-layout-masonry-line' },
  { href: '/loftlog/management/audit', label: 'Audit', icon: 'ri-check-double-line' },
  { href: '/loftlog/management/documents', label: 'Documents & Value', icon: 'ri-file-shield-line' },
  { href: '/loftlog/management/activity', label: 'Activity', icon: 'ri-history-line' },
];

export default function LoftLogSidebar() {
  const pathname = usePathname();
  const [workspaceOpen, setWorkspaceOpen] = useState(true);

  return (
    <aside className="w-60 bg-[#1a1a2e] text-white h-screen fixed left-0 top-0 z-30 flex flex-col overflow-y-auto">
      <div className="px-5 py-5 border-b border-white/10">
        <Link href="/loftlog" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-store-3-line text-white text-lg"></i>
          </div>
          <span className="font-[family-name:var(--font-pacifico)] text-xl text-white tracking-wide">LoftLog</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/loftlog' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} text-base`}></i>
              </span>
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-white/10">
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
          >
            Workspaces
            <span className="w-4 h-4 flex items-center justify-center">
              <i className={`${workspaceOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-sm`}></i>
            </span>
          </button>
          {workspaceOpen && (
            <div className="mt-1 space-y-1">
              {workspaceItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-teal-500/20 text-teal-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className={`${item.icon} text-sm`}></i>
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-500/30 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-400 text-xs font-bold">AM</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Alex Morgan</p>
            <p className="text-xs text-gray-500">Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}