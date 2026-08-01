import Link from 'next/link';

const guides = [
  { icon: 'ri-map-pin-line', title: 'Loft Map', desc: 'Learn how to set up racks, shelves, and positions' },
  { icon: 'ri-barcode-line', title: 'Labels & QR Codes', desc: 'Print and scan container labels' },
  { icon: 'ri-qr-scan-line', title: 'Scanning', desc: 'How to scan items and boxes efficiently' },
  { icon: 'ri-sparkling-line', title: 'AI Review', desc: 'Understanding and managing AI suggestions' },
  { icon: 'ri-check-double-line', title: 'Audits', desc: 'Running box audits and verifying contents' },
];

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Help & Guides</h1>
      <p className="text-sm text-gray-500 mb-6">Quick start guides and reference for LoftLog features.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-teal-100 rounded flex items-center justify-center"><i className="ri-check-line text-teal-600 text-xs"></i></span>
          First-Use Checklist
        </h3>
        <div className="space-y-3">
          {[
            'Set up your loft dimensions and create racks',
            'Create and print labels for your first container',
            'Add your first item using desktop or Quick Add',
            'Try the AI assistant to search for items',
            'Invite household members',
            'Run your first box audit',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">{i + 1}</span>
              <span className="text-sm text-gray-700">{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {guides.map(g => (
          <div key={g.title} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <span className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
              <i className={`${g.icon} text-gray-600 text-lg`}></i>
            </span>
            <h3 className="text-sm font-semibold text-gray-800">{g.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}