'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mockActivityLog } from '@/lib/loftlog/mock-data';

const actionTypes = ['All', 'Added item', 'Loaned item', 'Marked item', 'Verified box', 'Updated item', 'Catalogue', 'Acknowledged'];

export default function ActivityWorkspace() {
  const [filter, setFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');

  const filtered = mockActivityLog.filter(log => {
    if (filter !== 'All' && !log.action.toLowerCase().includes(filter.toLowerCase().replace('item', '').trim())) return false;
    if (userFilter !== 'All' && log.userName !== userFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Complete audit trail of all changes</p>
        </div>
        <div className="flex gap-2">
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 pr-8"
          >
            <option value="All">All Users</option>
            <option value="Alex Morgan">Alex Morgan</option>
            <option value="Sam Taylor">Sam Taylor</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        {actionTypes.map(a => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              filter === a ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.userName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.resourceType === 'item' ? (
                      <Link href={`/loftlog/items/${log.resourceId}`} className="text-teal-600 hover:text-teal-700">{log.resourceName}</Link>
                    ) : (
                      log.resourceName
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      log.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                      log.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{log.riskLevel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">No activity matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}