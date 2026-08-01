'use client';

import { useSidebar } from '@/lib/SidebarContext';
import type { ReactNode } from 'react';

export default function SidebarAwareWrapper({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
      {children}
    </div>
  );
}