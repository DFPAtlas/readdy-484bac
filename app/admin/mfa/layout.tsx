import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Two-step verification',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}