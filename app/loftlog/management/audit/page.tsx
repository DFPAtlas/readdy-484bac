import Link from 'next/link';
import { mockContainers } from '@/lib/loftlog/mock-data';

export default function AuditWorkspace() {
  const unchecked = mockContainers.filter(c => {
    if (!c.lastCheckedAt) return true;
    return new Date(c.lastCheckedAt) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  });
  const recentlyChecked = mockContainers.filter(c => {
    if (!c.lastCheckedAt) return false;
    return new Date(c.lastCheckedAt) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">{unchecked.length} boxes due for verification</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-play-line text-sm"></i></span>
            Start Audit
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-printer-line text-sm"></i></span>
            Print Sheet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-100 rounded flex items-center justify-center"><i className="ri-timer-line text-amber-600 text-xs"></i></span>
            Due for Verification ({unchecked.length})
          </h3>
          <div className="space-y-2">
            {unchecked.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{c.lastCheckedAt ? `Last: ${new Date(c.lastCheckedAt).toLocaleDateString('en-GB')}` : 'Never checked'}</span>
                  <button className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">Verify</button>
                </div>
              </div>
            ))}
            {unchecked.length === 0 && <p className="text-sm text-gray-400 text-center py-4">All boxes checked recently!</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-green-100 rounded flex items-center justify-center"><i className="ri-check-line text-green-600 text-xs"></i></span>
            Recently Verified ({recentlyChecked.length})
          </h3>
          <div className="space-y-2">
            {recentlyChecked.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                </div>
                <span className="text-xs text-green-600 font-medium">
                  {new Date(c.lastCheckedAt!).toLocaleDateString('en-GB')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}