import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post a Security Job',
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