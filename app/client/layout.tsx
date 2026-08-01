import { Metadata } from 'next';
import ClientAuthGate from '@/components/ClientAuthGate';
import MobileClientNav from '@/components/MobileClientNav';
import { SidebarProvider } from '@/lib/SidebarContext';
import { ClientAuthProvider } from '@/lib/ClientAuthContext';
import SidebarAwareWrapper from './SidebarAwareWrapper';

export const metadata: Metadata = {
  title: 'Client Portal | QuickGuard',
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ClientAuthProvider>
        <ClientAuthGate>
          <SidebarAwareWrapper>
            {children}
          </SidebarAwareWrapper>
        </ClientAuthGate>
        <MobileClientNav />
      </ClientAuthProvider>
    </SidebarProvider>
  );
}