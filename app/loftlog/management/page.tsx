import Link from 'next/link';

const workspaces = [
  { href: '/loftlog/management/inventory', label: 'Inventory', desc: 'Items and containers with bulk edit, move, export', icon: 'ri-stack-line', color: 'bg-teal-50 text-teal-600' },
  { href: '/loftlog/management/storage', label: 'Storage Planning', desc: 'Loft map, capacity, drag-and-drop moves', icon: 'ri-layout-masonry-line', color: 'bg-blue-50 text-blue-600' },
  { href: '/loftlog/management/audit', label: 'Audit', desc: 'Verify boxes, track differences, printable sheets', icon: 'ri-check-double-line', color: 'bg-amber-50 text-amber-600' },
  { href: '/loftlog/management/documents', label: 'Documents & Value', desc: 'Receipts, warranties, insurance exports', icon: 'ri-file-shield-line', color: 'bg-indigo-50 text-indigo-600' },
  { href: '/loftlog/management/activity', label: 'Activity', desc: 'Full audit trail, filter by user, rollback', icon: 'ri-history-line', color: 'bg-gray-100 text-gray-600' },
];

export default function ManagementPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Management Centre</h1>
      <p className="text-sm text-gray-500 mb-6">Desktop control centre for managing your loft inventory.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map(ws => (
          <Link key={ws.href} href={ws.href} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group">
            <div className={`w-10 h-10 ${ws.color} rounded-xl flex items-center justify-center mb-3`}>
              <i className={`${ws.icon} text-lg`}></i>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 group-hover:text-teal-600 transition-colors">{ws.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{ws.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}