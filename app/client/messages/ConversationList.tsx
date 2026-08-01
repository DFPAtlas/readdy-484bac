'use client';

import { useState } from 'react';
import SearchFilterBar, { FilterConfig } from '../components/SearchFilterBar';

interface Conversation {
  id: string;
  job_id: string | null;
  other_user_id: string;
  other_type: string;
  other_name: string;
  other_avatar: string | null;
  other_initials: string;
  other_rating: number | null;
  job_title: string | null;
  job_city: string | null;
  job_status: string | null;
  last_message: string;
  last_time: string;
  unread_count: number;
  status: string;
  is_support: boolean;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  filter: string;
  searchQuery: string;
  totalUnread: number;
  onFilterChange: (f: 'all' | 'job' | 'guard' | 'support' | 'unread' | 'archived') => void;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  onFilterChangeAdvanced: (key: string, value: string) => void;
  sortOptions: { value: string; label: string }[];
  filterConfigs: FilterConfig[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const filters: { key: 'all' | 'job' | 'guard' | 'support' | 'unread' | 'archived'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'ri-message-3-line' },
  { key: 'job', label: 'Jobs', icon: 'ri-briefcase-line' },
  { key: 'guard', label: 'Guards', icon: 'ri-shield-user-line' },
  { key: 'support', label: 'Support', icon: 'ri-customer-service-2-line' },
  { key: 'unread', label: 'Unread', icon: 'ri-mail-unread-line' },
  { key: 'archived', label: 'Archived', icon: 'ri-archive-line' },
];

export default function ConversationList({
  conversations,
  activeId,
  filter,
  searchQuery,
  totalUnread,
  onFilterChange,
  onSearchChange,
  onSelect,
  // New props
  sortBy,
  onSortChange,
  showFilters,
  onToggleFilters,
  onClearFilters,
  onFilterChangeAdvanced,
  sortOptions,
  filterConfigs,
  // Bulk selection
  selectable,
  selectedIds,
  onToggleSelect,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#0B1933]">
      <div className="px-5 py-4 border-b border-[#1e2d4d]">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <i className={`${showSearch ? 'ri-close-line' : 'ri-search-line'} text-base`}></i>
          </button>
        </div>

        {/* SearchFilterBar */}
        <div className="mb-3">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search conversations..."
            filters={{
              type: filter,
              status: filter === 'unread' ? 'unread' : 'all',
            }}
            onFilterChange={onFilterChangeAdvanced}
            filterConfigs={filterConfigs}
            sortBy={sortBy}
            onSortChange={onSortChange}
            sortOptions={sortOptions}
            resultCount={conversations.length}
            loading={false}
            onClear={onClearFilters}
            showMobilePanel={showFilters}
            onToggleMobilePanel={onToggleFilters}
          />
        </div>

        {/* Legacy filter pills for quick switching */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === f.key
                  ? 'bg-teal-500 text-slate-900'
                  : 'bg-[#162036] text-slate-400 hover:text-slate-200 border border-[#1e2d4d]'
              }`}
            >
              <i className={f.icon}></i>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 bg-[#162036] rounded-2xl flex items-center justify-center mb-3 border border-[#1e2d4d]">
              <i className={`${filter === 'archived' ? 'ri-archive-line' : searchQuery ? 'ri-search-line' : 'ri-message-3-line'} text-2xl text-slate-600`}></i>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {searchQuery ? 'No search results' : filter === 'archived' ? 'No archived conversations' : filter === 'unread' ? 'No unread messages' : 'No messages yet'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {searchQuery
                ? 'Try a different search term.'
                : filter === 'archived'
                ? 'Archive conversations to view them here.'
                : filter === 'unread'
                ? 'All caught up!'
                : 'Messages from guards and support will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <ul>
              {conversations.map((conv) => (
                <li
                  key={conv.id}
                  onClick={() => {
                    if (selectable && onToggleSelect) {
                      onToggleSelect(conv.id);
                      return;
                    }
                    onSelect(conv.id);
                  }}
                  className={`flex items-start gap-3 px-5 py-4 border-b border-[#1e2d4d] cursor-pointer transition-colors ${
                    activeId === conv.id && !selectable
                      ? 'bg-[#162036]'
                      : conv.unread_count > 0 && !selectable
                      ? 'bg-teal-500/5 hover:bg-teal-500/10'
                      : selectable && selectedIds?.has(conv.id)
                      ? 'bg-teal-500/10'
                      : 'hover:bg-[#162036]/50'
                  }`}
                >
                  {selectable && (
                    <label className="flex items-center pt-2 cursor-pointer flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(conv.id) || false}
                        onChange={() => onToggleSelect?.(conv.id)}
                        className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
                      />
                    </label>
                  )}
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
                      {conv.other_avatar ? (
                        <img src={conv.other_avatar} alt={conv.other_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-teal-400 font-bold text-xs">{conv.other_initials}</span>
                      )}
                    </div>
                    {conv.unread_count > 0 && !selectable && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-teal-500 text-slate-900 text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0B1933]">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                    {conv.is_support && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center border-2 border-[#0B1933]">
                        <i className="ri-customer-service-2-line text-[8px] text-white"></i>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? 'text-white' : 'text-slate-300'}`}>
                          {conv.other_name}
                        </p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          conv.is_support
                            ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                            : conv.other_type === 'guard'
                            ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                            : 'bg-slate-500/15 text-slate-400 border border-slate-500/25'
                        }`}>
                          {conv.is_support ? 'Support' : conv.other_type === 'guard' ? 'Guard' : 'Admin'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 flex-shrink-0">{timeAgo(conv.last_time)}</span>
                    </div>

                    {conv.job_title && (
                      <p className="text-[11px] text-teal-500 mt-0.5 truncate flex items-center gap-1">
                        <i className="ri-briefcase-line"></i>
                        {conv.job_title}
                        {conv.job_city && <span className="text-slate-600">· {conv.job_city}</span>}
                      </p>
                    )}

                    <p className={`text-xs mt-1 leading-relaxed truncate ${conv.unread_count > 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                      {conv.last_message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        conv.status === 'Open'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : conv.status === 'Awaiting Reply'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {conv.status}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="text-[10px] text-teal-400 font-semibold">
                          {conv.unread_count} new
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="px-5 py-4 flex justify-center">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl bg-[#162036] hover:bg-[#1a2642] transition-colors border border-[#1e2d4d] cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <i className="ri-arrow-down-line"></i>
                      Load more conversations
                    </span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}