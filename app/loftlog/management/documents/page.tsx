import Link from 'next/link';
import { mockItems } from '@/lib/loftlog/mock-data';

const valuableItems = mockItems.filter(i => i.estimatedValue && i.estimatedValue > 50);
const itemsWithSerial = mockItems.filter(i => i.serialNumber);
const itemsWithWarranty = mockItems.filter(i => i.warrantyExpiry);
const totalValue = mockItems.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);

export default function DocumentsWorkspace() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents & Value</h1>
          <p className="text-sm text-gray-500 mt-1">{valuableItems.length} valuable items · Total estimated value: £{totalValue.toFixed(2)}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line text-sm"></i></span>
          Export for Insurance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-3xl font-bold text-gray-900">£{totalValue.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Total estimated value</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-3xl font-bold text-gray-900">{itemsWithSerial.length}</p>
          <p className="text-xs text-gray-500 mt-1">Items with serial numbers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-3xl font-bold text-gray-900">{itemsWithWarranty.length}</p>
          <p className="text-xs text-gray-500 mt-1">Items under warranty</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Valuable Items (£50+)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Item</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Value</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Serial</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Warranty</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {valuableItems.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/loftlog/items/${item.id}`} className="font-medium text-gray-900 hover:text-teal-600">{item.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-700">£{item.estimatedValue}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{item.serialNumber || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {item.receipts.length > 0 ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-red-500">Missing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}