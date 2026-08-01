'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(localStorage.getItem('portal-sidebar-collapsed') === 'true');
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && typeof window !== 'undefined') {
      localStorage.setItem('portal-sidebar-collapsed', String(collapsed));
    }
  }, [collapsed, hydrated]);

  const toggle = useCallback(() => setCollapsed(prev => !prev), []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}