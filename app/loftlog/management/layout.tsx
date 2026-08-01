import Link from 'next/link';

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <Link href="/loftlog" className="hover:text-gray-600 transition-colors">LoftLog</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Management</span>
      </div>
      {children}
    </div>
  );
}