import { Metadata } from 'next';
import { SidebarProvider } from '@/lib/SidebarContext';
import GuardAuthGate from '@/components/GuardAuthGate';

export const metadata: Metadata = {
  title: 'Guard Portal | QuickGuard',
};

export default function GuardPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuardAuthGate>
      <SidebarProvider>{children}</SidebarProvider>
    </GuardAuthGate>
  );
}