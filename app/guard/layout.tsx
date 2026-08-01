import { Metadata } from 'next';
import GuardAuthGate from '@/components/GuardAuthGate';

export const metadata: Metadata = {
  title: 'Guard Portal | QuickGuard',
};

export default function GuardPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuardAuthGate>
      {children}
    </GuardAuthGate>
  );
}