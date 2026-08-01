import Link from 'next/link';
import { mockItems } from '@/lib/loftlog/mock-data';

const clearoutItems = mockItems.filter(i => i.decisionStatus && ['sell', 'donate', 'dispose', 'unsure'].includes(i.decisionStatus));

const columns: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'sell', label: 'Sell', icon: 'ri-price-tag-3-line', color: 'bg-amber-50 border-amber-200' },
  { key: 'donate', label: 'Donate', icon: 'ri-hand-heart-line', color: 'bg-purple-50 border-purple-200' },
  { key: 'dispose', label: 'Dispose', icon: 'ri-delete-bin-line', color: 'bg-red-50 border-red-200' },
  { key: 'unsure', label: 'Unsure', icon: 'ri-question-line', color: 'bg-gray-50 border-gray-200' },
];

export default function ClearoutPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog" className="hover:text-gray-600 transition-colors">LoftLog</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Items to Clear</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items to Clear</h1>
          <p className="text-sm text-gray-500 mt-1">{clearoutItems.length} items ready for action</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-printer-line text-sm"></i></span>
            Print Lists
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line text-sm"></i></span>
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => {
          const items = clearoutItems.filter(i => i.decisionStatus === col.key);
          const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
          return (
            <div key={col.key} className={`rounded-xl border p-4 ${col.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${col.icon} text-gray-600 text-sm`}></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{col.label}</p>
                  <p className="text-xs text-gray-500">{items.length} items · £{totalValue.toFixed(2)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {items.map(item => (
                  <Link
                    key={item.id}
                    href={`/loftlog/items/${item.id}`}
                    className="block bg-white rounded-lg p-3 hover:shadow-sm transition-shadow border border-gray-100"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400 font-mono">{item.containerCode}</span>
                      {item.estimatedValue && (
                        <span className="text-xs font-medium text-gray-600">£{item.estimatedValue}</span>
                      )}
                    </div>
                  </Link>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No items in this column</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}