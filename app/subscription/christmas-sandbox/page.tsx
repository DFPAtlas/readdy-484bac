import type { Metadata } from 'next';
import ChristmasSandboxClient from './ChristmasSandboxClient';

export const metadata: Metadata = {
  title: 'Christmas offer sandbox (test only) | QuickGuard',
  description: 'Internal test-only preview of the QuickGuard Christmas subscription offer.',
  robots: { index: false, follow: false },
};

export default function ChristmasSandboxPage() {
  return <ChristmasSandboxClient />;
}