'use client';

import Link from 'next/link';
import { mockItems, mockContainers, mockRacks, mockActivityLog } from '@/lib/loftlog/mock-data';
import { useState } from 'react';

interface DashboardCard {
  id: string;
  title: string;
  visible: boolean;
}

const defaultCards: DashboardCard[] = [
  { id: 'progress', title: 'Cataloguing Progress', visible: true },
  { id: 'totals', title: 'Inventory Overview', visible: true },
  { id: 'storage', title: 'Storage Capacity', visible: true },
  { id: 'unchecked', title: 'Overdue Checks', visible: true },
  { id: 'ai', title: 'AI Drafts', visible: true },
  { id: 'loans', title: 'Items on Loan', visible: true },
  { id: 'clearout', title: 'Items to Clear', visible: true },
  { id: 'important', title: 'Important & Sentimental', visible: true },
  { id: 'activity', title: 'Recent Activity', visible: true },
  { id: 'quick', title: 'Quick Actions', visible: true },
];

export default function DashboardClient() {
  const [cards, setCards] = useState<DashboardCard[]>(defaultCards);
  const [customizing, setCustomizing] = useState(false);

  const totalItems = mockItems.length;
  const cataloguedContainers = mockContainers.filter(c => c.status === 'catalogued').length;
  const totalContainers = mockContainers.length;
  const totalRacks = mockRacks.length;
  const totalPositions = mockRacks.reduce((sum, r) => sum + r.totalShelves * 4, 0);
  const occupiedPositions = totalContainers;
  const loanedItems = mockItems.filter(i => i.status === 'on_loan').length;
  const missingItems = mockItems.filter(i => i.status === 'missing').length;
  const clearoutItems = mockItems.filter(i => i.decisionStatus && ['sell', 'donate', 'dispose', 'unsure'].includes(i.decisionStatus)).length;
  const importantItems = mockItems.filter(i => i.isImportant || i.isSentimental).length;
  const aiPending = mockItems.filter(i => i.aiReviewStatus === 'pending').length;
  const storageWarnings = mockItems.filter(i => i.storageWarnings.some(w => !w.acknowledged)).length;
  const uncheckedBoxes = mockContainers.filter(c => {
    if (!c.lastCheckedAt) return true;
    return new Date(c.lastCheckedAt) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }).length;

  const toggleCard = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const resetCards = () => setCards(defaultCards);
  const visibleCards = cards.filter(c => c.visible);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, Alex. Here&apos;s your loft overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCustomizing(!customizing)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              customizing ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-layout-3-line text-sm"></i></span>
            Customise
          </button>
          {customizing && (
            <button onClick={resetCards} className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
              Reset to default
            </button>
          )}
        </div>
      </div>

      {customizing && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Toggle dashboard cards</p>
          <div className="flex flex-wrap gap-2">
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  card.visible
                    ? 'bg-teal-100 text-teal-700 border border-teal-300'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {card.visible ? <i className="ri-eye-line mr-1.5"></i> : <i className="ri-eye-off-line mr-1.5"></i>}
                {card.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleCards.map(card => {
          switch (card.id) {
            case 'progress':
              return <ProgressCard key={card.id} catalogued={cataloguedContainers} total={totalContainers} items={totalItems} />;
            case 'totals':
              return <TotalsCard key={card.id} items={totalItems} containers={totalContainers} racks={totalRacks} />;
            case 'storage':
              return <StorageCard key={card.id} occupied={occupiedPositions} total={totalPositions} unchecked={uncheckedBoxes} warnings={storageWarnings} />;
            case 'unchecked':
              return <UncheckedCard key={card.id} count={uncheckedBoxes} />;
            case 'ai':
              return <AiCard key={card.id} count={aiPending} />;
            case 'loans':
              return <LoansCard key={card.id} loaned={loanedItems} missing={missingItems} />;
            case 'clearout':
              return <ClearoutCard key={card.id} count={clearoutItems} />;
            case 'important':
              return <ImportantCard key={card.id} count={importantItems} />;
            case 'activity':
              return <ActivityCard key={card.id} logs={mockActivityLog.slice(0, 5)} />;
            case 'quick':
              return <QuickActions key={card.id} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

function ProgressCard({ catalogued, total, items }: { catalogued: number; total: number; items: number }) {
  const pct = Math.round((catalogued / total) * 100);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-pie-chart-line text-teal-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">Cataloguing Progress</p>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold text-gray-900">{pct}%</span>
        <span className="text-sm text-gray-500 mb-1">{catalogued}/{total} boxes</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{items} items catalogued across {catalogued} containers</p>
    </div>
  );
}

function TotalsCard({ items, containers, racks }: { items: number; containers: number; racks: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <p className="text-sm font-semibold text-gray-700 mb-4">Inventory Overview</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{items}</p>
          <p className="text-xs text-gray-500 mt-0.5">Items</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{containers}</p>
          <p className="text-xs text-gray-500 mt-0.5">Boxes</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{racks}</p>
          <p className="text-xs text-gray-500 mt-0.5">Racks</p>
        </div>
      </div>
      <Link href="/loftlog/items" className="block text-center text-sm text-teal-600 hover:text-teal-700 mt-4 font-medium">
        View all items →
      </Link>
    </div>
  );
}

function StorageCard({ occupied, total, unchecked, warnings }: { occupied: number; total: number; unchecked: number; warnings: number }) {
  const pct = Math.round((occupied / total) * 100);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-layout-masonry-line text-blue-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">Storage Capacity</p>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold text-gray-900">{pct}%</span>
        <span className="text-sm text-gray-500 mb-1">{occupied}/{total} positions</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        {unchecked > 0 && <span className="text-amber-600">{unchecked} boxes unchecked</span>}
        {warnings > 0 && <span className="text-red-500">{warnings} storage warnings</span>}
      </div>
    </div>
  );
}

function UncheckedCard({ count }: { count: number }) {
  return (
    <Link href="/loftlog/management/audit" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-timer-line text-amber-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">Overdue Checks</p>
      </div>
      <p className="text-3xl font-bold text-amber-600">{count}</p>
      <p className="text-xs text-gray-500 mt-1">Boxes not checked in 90+ days</p>
    </Link>
  );
}

function AiCard({ count }: { count: number }) {
  return (
    <Link href="/loftlog/ai-review" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-sparkling-line text-purple-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">AI Drafts</p>
      </div>
      <p className="text-3xl font-bold text-purple-600">{count}</p>
      <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
    </Link>
  );
}

function LoansCard({ loaned, missing }: { loaned: number; missing: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <p className="text-sm font-semibold text-gray-700 mb-3">Items Removed or Loaned</p>
      <div className="flex items-center gap-6">
        <div>
          <p className="text-2xl font-bold text-indigo-600">{loaned}</p>
          <p className="text-xs text-gray-500">On Loan</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-500">{missing}</p>
          <p className="text-xs text-gray-500">Missing</p>
        </div>
      </div>
    </div>
  );
}

function ClearoutCard({ count }: { count: number }) {
  return (
    <Link href="/loftlog/clearout" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-delete-back-line text-rose-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">Items to Clear</p>
      </div>
      <p className="text-3xl font-bold text-rose-600">{count}</p>
      <p className="text-xs text-gray-500 mt-1">Sell, donate, or dispose</p>
    </Link>
  );
}

function ImportantCard({ count }: { count: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-star-line text-yellow-600 text-sm"></i>
        </span>
        <p className="text-sm font-semibold text-gray-700">Important & Sentimental</p>
      </div>
      <p className="text-3xl font-bold text-yellow-600">{count}</p>
      <p className="text-xs text-gray-500 mt-1">Items marked important or sentimental</p>
    </div>
  );
}

function ActivityCard({ logs }: { logs: typeof mockActivityLog }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Recent Activity</p>
        <Link href="/loftlog/management/activity" className="text-xs text-teal-600 hover:text-teal-700 font-medium">View all</Link>
      </div>
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-gray-500">{log.userName.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">
                <span className="font-medium">{log.userName}</span> {log.action.toLowerCase()} <span className="font-medium">{log.resourceName}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <p className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/loftlog/items/add" className="flex items-center gap-2 px-3 py-2.5 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-add-box-line text-sm"></i></span>
          Add Item
        </Link>
        <Link href="/loftlog/items/add/mobile" className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-smartphone-line text-sm"></i></span>
          Quick Add
        </Link>
        <Link href="/loftlog/management/inventory" className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-stack-line text-sm"></i></span>
          Inventory
        </Link>
        <Link href="/loftlog/management/audit" className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-check-double-line text-sm"></i></span>
          Run Audit
        </Link>
      </div>
    </div>
  );
}