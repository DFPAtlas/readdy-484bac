'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { mockItems, mockCategories, mockSavedViews, mockContainers, mockRacks } from '@/lib/loftlog/mock-data';
import { Item, ViewMode, ItemFilters, ItemSort, SavedView } from '@/lib/loftlog/types';

export default function ItemsClient() {
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<string>('sv1');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ItemFilters>({
    search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [],
    condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null,
    aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false,
  });
  const [sort, setSort] = useState<ItemSort>({ field: 'recently_added', direction: 'desc' });
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  const sortedFilteredItems = useMemo(() => {
    let items = [...mockItems];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.keywords.some(k => k.toLowerCase().includes(q)) ||
        i.brand.toLowerCase().includes(q) ||
        i.model.toLowerCase().includes(q) ||
        i.serialNumber.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.containerCode && i.containerCode.toLowerCase().includes(q)) ||
        (i.rackCode && i.rackCode.toLowerCase().includes(q)) ||
        i.searchableText.toLowerCase().includes(q)
      );
    }
    if (filters.category.length > 0) items = items.filter(i => filters.category.includes(i.category));
    if (filters.containerId.length > 0) items = items.filter(i => i.containerId && filters.containerId.includes(i.containerId));
    if (filters.rackId.length > 0) items = items.filter(i => i.rackId && filters.rackId.includes(i.rackId));
    if (filters.status.length > 0) items = items.filter(i => filters.status.includes(i.status));
    if (filters.decisionStatus.length > 0) items = items.filter(i => i.decisionStatus && filters.decisionStatus.includes(i.decisionStatus));
    if (filters.condition.length > 0) items = items.filter(i => filters.condition.includes(i.condition));
    if (filters.isImportant !== null) items = items.filter(i => i.isImportant === filters.isImportant);
    if (filters.isSentimental !== null) items = items.filter(i => i.isSentimental === filters.isSentimental);
    if (filters.isSeasonal !== null) items = items.filter(i => i.isSeasonal === filters.isSeasonal);
    if (filters.isFragile !== null) items = items.filter(i => i.isFragile === filters.isFragile);
    if (filters.missingOnly) items = items.filter(i => i.status === 'missing');
    if (filters.aiReviewState) items = items.filter(i => i.aiReviewStatus === filters.aiReviewState);

    items.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case 'recently_added': cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); break;
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'location': cmp = (a.containerCode || '').localeCompare(b.containerCode || ''); break;
        case 'value': cmp = (b.estimatedValue || 0) - (a.estimatedValue || 0); break;
        case 'last_checked': cmp = new Date(b.lastCheckedAt || 0).getTime() - new Date(a.lastCheckedAt || 0).getTime(); break;
        case 'oldest_unverified': cmp = new Date(a.lastVerifiedAt || 0).getTime() - new Date(b.lastVerifiedAt || 0).getTime(); break;
      }
      return sort.direction === 'asc' ? -cmp : cmp;
    });
    return items;
  }, [filters, sort]);

  const handleSelectAll = () => {
    if (selectedIds.size === sortedFilteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedFilteredItems.map(i => i.id)));
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const applySavedView = (sv: SavedView) => {
    setActiveView(sv.id);
    setFilters(sv.filters);
    setSort(sv.sort);
    setViewMode(sv.viewMode);
    setSelectedIds(new Set());
  };

  const toggleFilter = (field: keyof ItemFilters, value: string) => {
    setFilters(prev => {
      const arr = prev[field] as string[];
      if (arr.includes(value)) return { ...prev, [field]: arr.filter(v => v !== value) };
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const clearFilters = () => {
    setFilters({ search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false });
    setActiveView('sv1');
  };

  const activeFilterCount = filters.category.length + filters.containerId.length + filters.rackId.length + filters.status.length + filters.decisionStatus.length + filters.condition.length + (filters.isImportant !== null ? 1 : 0) + (filters.isSentimental !== null ? 1 : 0) + (filters.isSeasonal !== null ? 1 : 0) + (filters.isFragile !== null ? 1 : 0) + (filters.missingOnly ? 1 : 0) + (filters.aiReviewState ? 1 : 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items</h1>
          <p className="text-sm text-gray-500 mt-1">{sortedFilteredItems.length} items{activeFilterCount > 0 && ` · ${activeFilterCount} active filters`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/loftlog/items/add" className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line text-sm"></i></span>
            Add Item
          </Link>
          <Link href="/loftlog/items/add/mobile" className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-smartphone-line text-sm"></i></span>
            Quick Add
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {mockSavedViews.map(sv => (
          <button
            key={sv.id}
            onClick={() => applySavedView(sv)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeView === sv.id
                ? 'bg-teal-100 text-teal-700 border border-teal-300'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${sv.icon} text-xs`}></i></span>
            {sv.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
            <i className="ri-search-line text-gray-400 text-sm"></i>
          </span>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="Search items, serial numbers, locations..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
            showFilters ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-filter-3-line text-sm"></i></span>
          Filters
          {activeFilterCount > 0 && <span className="bg-teal-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
        </button>

        <select
          value={`${sort.field}-${sort.direction}`}
          onChange={(e) => {
            const [field, direction] = e.target.value.split('-') as [ItemSort['field'], ItemSort['direction']];
            setSort({ field, direction });
          }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
        >
          <option value="recently_added-desc">Recently Added</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="location-asc">Location</option>
          <option value="value-desc">Highest Value</option>
          <option value="last_checked-desc">Last Checked</option>
          <option value="oldest_unverified-asc">Oldest Unverified</option>
        </select>

        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('gallery')}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'gallery' ? 'bg-white shadow text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-layout-grid-line"></i></span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'list' ? 'bg-white shadow text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-list-check"></i></span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'table' ? 'bg-white shadow text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-table-line"></i></span>
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="relative">
            <button
              onClick={() => setBulkActionOpen(!bulkActionOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors whitespace-nowrap"
            >
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-check-double-line text-sm"></i></span>
              {selectedIds.size} selected
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-down-s-line text-sm"></i></span>
            </button>
            {bulkActionOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-40 py-2">
                <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-right-line text-gray-400"></i></span>
                  Move
                </button>
                <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-price-tag-3-line text-gray-400"></i></span>
                  Change Category
                </button>
                <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line text-gray-400"></i></span>
                  Export
                </button>
                <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-archive-line text-gray-400"></i></span>
                  Archive
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                    <span className="w-4 h-4 flex items-center justify-center"><i className="ri-printer-line text-gray-400"></i></span>
                    Print Pick List
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <FilterGroup label="Category" icon="ri-price-tag-3-line">
            {mockCategories.map(cat => (
              <FilterChip key={cat.id} active={filters.category.includes(cat.name)} onClick={() => toggleFilter('category', cat.name)}>
                {cat.name}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Status" icon="ri-checkbox-circle-line">
            {['in_storage', 'on_loan', 'removed', 'missing', 'sold', 'donated', 'disposed'].map(s => (
              <FilterChip key={s} active={filters.status.includes(s)} onClick={() => toggleFilter('status', s)}>
                {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Decision" icon="ri-scales-line">
            {['keep', 'sell', 'donate', 'dispose', 'unsure'].map(s => (
              <FilterChip key={s} active={filters.decisionStatus.includes(s)} onClick={() => toggleFilter('decisionStatus', s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Condition" icon="ri-heart-pulse-line">
            {['new', 'like_new', 'good', 'fair', 'poor', 'damaged', 'for_parts'].map(s => (
              <FilterChip key={s} active={filters.condition.includes(s)} onClick={() => toggleFilter('condition', s)}>
                {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Flags" icon="ri-flag-line">
            <FilterChip active={filters.isImportant === true} onClick={() => setFilters(p => ({ ...p, isImportant: p.isImportant === true ? null : true }))}>
              Important
            </FilterChip>
            <FilterChip active={filters.isSentimental === true} onClick={() => setFilters(p => ({ ...p, isSentimental: p.isSentimental === true ? null : true }))}>
              Sentimental
            </FilterChip>
            <FilterChip active={filters.isSeasonal === true} onClick={() => setFilters(p => ({ ...p, isSeasonal: p.isSeasonal === true ? null : true }))}>
              Seasonal
            </FilterChip>
            <FilterChip active={filters.isFragile === true} onClick={() => setFilters(p => ({ ...p, isFragile: p.isFragile === true ? null : true }))}>
              Fragile
            </FilterChip>
            <FilterChip active={filters.missingOnly} onClick={() => setFilters(p => ({ ...p, missingOnly: !p.missingOnly }))}>
              Missing Only
            </FilterChip>
          </FilterGroup>
          <FilterGroup label="Container" icon="ri-archive-line">
            {mockContainers.map(c => (
              <FilterChip key={c.id} active={filters.containerId.includes(c.id)} onClick={() => toggleFilter('containerId', c.id)}>
                {c.code}
              </FilterChip>
            ))}
          </FilterGroup>
          {activeFilterCount > 0 && (
            <div className="col-span-full">
              <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-600 font-medium">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {sortedFilteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-archive-line text-gray-400 text-2xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No items found</h3>
          <p className="text-sm text-gray-500 mb-4">Try adjusting your search or filters, or start by adding your first item.</p>
          <Link href="/loftlog/items/add" className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line text-sm"></i></span>
            Add Your First Item
          </Link>
        </div>
      ) : viewMode === 'gallery' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedFilteredItems.map(item => (
            <ItemGalleryCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={() => handleSelect(item.id)}
            />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sortedFilteredItems.map((item, idx) => (
            <ItemListRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={() => handleSelect(item.id)}
              isLast={idx === sortedFilteredItems.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selectedIds.size === sortedFilteredItems.length && sortedFilteredItems.length > 0} onChange={handleSelectAll} className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredItems.map(item => (
                  <ItemTableRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    onSelect={() => handleSelect(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${icon} text-gray-400 text-xs`}></i></span>
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    in_storage: { color: 'bg-green-100 text-green-700', label: 'In Storage' },
    on_loan: { color: 'bg-indigo-100 text-indigo-700', label: 'On Loan' },
    removed: { color: 'bg-amber-100 text-amber-700', label: 'Removed' },
    missing: { color: 'bg-red-100 text-red-700', label: 'Missing' },
    sold: { color: 'bg-blue-100 text-blue-700', label: 'Sold' },
    donated: { color: 'bg-purple-100 text-purple-700', label: 'Donated' },
    disposed: { color: 'bg-gray-200 text-gray-600', label: 'Disposed' },
  };
  const info = map[status] || { color: 'bg-gray-100 text-gray-600', label: status };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${info.color}`}>{info.label}</span>;
}

function ItemGalleryCard({ item, selected, onSelect }: { item: Item; selected: boolean; onSelect: () => void }) {
  const primaryPhoto = item.photos.find(p => p.isPrimary);
  return (
    <div className={`bg-white rounded-xl border transition-all group cursor-pointer hover:shadow-md ${selected ? 'ring-2 ring-teal-500 border-teal-300' : 'border-gray-200'}`}>
      <div className="relative">
        <div className="h-44 bg-gray-100 rounded-t-xl overflow-hidden">
          {primaryPhoto ? (
            <img src={primaryPhoto.thumbnailUrl || primaryPhoto.url} alt={item.name} className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="ri-image-line text-gray-300 text-4xl"></i>
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); }}
          className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            selected ? 'bg-teal-500 text-white' : 'bg-white/90 text-gray-400 hover:bg-white'
          }`}
        >
          <i className={`${selected ? 'ri-check-line' : 'ri-checkbox-blank-line'} text-sm`}></i>
        </button>
        <div className="absolute top-2 right-2 flex gap-1">
          {item.isImportant && <span className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center"><i className="ri-star-fill text-white text-[10px]"></i></span>}
          {item.isSentimental && <span className="w-5 h-5 bg-pink-400 rounded flex items-center justify-center"><i className="ri-heart-fill text-white text-[10px]"></i></span>}
          {item.storageWarnings.filter(w => !w.acknowledged).length > 0 && (
            <span className="w-5 h-5 bg-red-400 rounded flex items-center justify-center"><i className="ri-error-warning-fill text-white text-[10px]"></i></span>
          )}
        </div>
      </div>
      <Link href={`/loftlog/items/${item.id}`} className="block p-3">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.category}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <span className="w-3 h-3 flex items-center justify-center"><i className="ri-map-pin-line text-[10px]"></i></span>
          <span className="truncate">{item.containerCode || 'No location'}</span>
        </div>
        {item.estimatedValue && (
          <p className="text-sm font-medium text-gray-800 mt-1.5">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency }).format(item.estimatedValue)}
          </p>
        )}
      </Link>
    </div>
  );
}

function ItemListRow({ item, selected, onSelect, isLast }: { item: Item; selected: boolean; onSelect: () => void; isLast: boolean }) {
  const primaryPhoto = item.photos.find(p => p.isPrimary);
  return (
    <div className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${selected ? 'bg-teal-50' : ''} ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <button onClick={onSelect} className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-teal-500 text-white' : 'border-2 border-gray-300'}`}>
        {selected && <i className="ri-check-line text-xs"></i>}
      </button>
      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {primaryPhoto ? (
          <img src={primaryPhoto.thumbnailUrl || primaryPhoto.url} alt="" className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><i className="ri-image-line text-gray-300 text-lg"></i></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link href={`/loftlog/items/${item.id}`} className="text-sm font-semibold text-gray-900 hover:text-teal-600 transition-colors truncate block">
          {item.name}
        </Link>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          <span>{item.category}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <i className="ri-map-pin-line text-[10px]"></i>
            {item.containerCode || '—'}
          </span>
          {item.quantity > 1 && <><span>·</span><span>Qty: {item.quantity}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={item.status} />
        {item.decisionStatus && item.decisionStatus !== 'keep' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{item.decisionStatus}</span>
        )}
        {item.estimatedValue && (
          <span className="text-sm font-medium text-gray-700 w-20 text-right">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency }).format(item.estimatedValue)}
          </span>
        )}
        <div className="flex gap-0.5">
          {item.isImportant && <span className="w-4 h-4 flex items-center justify-center text-yellow-500"><i className="ri-star-fill text-xs"></i></span>}
          {item.isFragile && <span className="w-4 h-4 flex items-center justify-center text-amber-500"><i className="ri-alert-line text-xs"></i></span>}
        </div>
      </div>
    </div>
  );
}

function ItemTableRow({ item, selected, onSelect }: { item: Item; selected: boolean; onSelect: () => void }) {
  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected ? 'bg-teal-50' : ''}`}>
      <td className="px-4 py-3">
        <button onClick={onSelect} className={`w-4 h-4 rounded flex items-center justify-center ${selected ? 'bg-teal-500 text-white' : 'border-2 border-gray-300'}`}>
          {selected && <i className="ri-check-line text-[10px]"></i>}
        </button>
      </td>
      <td className="px-4 py-3">
        <Link href={`/loftlog/items/${item.id}`} className="text-sm font-medium text-gray-900 hover:text-teal-600 transition-colors truncate block max-w-[250px]">
          {item.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
      <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{item.containerCode || '—'}</td>
      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {item.estimatedValue ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency }).format(item.estimatedValue) : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString('en-GB') : 'Never'}
      </td>
    </tr>
  );
}