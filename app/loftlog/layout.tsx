import Link from 'next/link';
import LoftLogHeader from '@/components/loftlog/LoftLogHeader';
import LoftLogSidebar from '@/components/loftlog/LoftLogSidebar';

export default function LoftLogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex">
      <LoftLogSidebar />
      <div className="flex-1 flex flex-col ml-60">
        <LoftLogHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}