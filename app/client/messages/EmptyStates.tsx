'use client';

import Link from 'next/link';

interface Props {
  type: 'select' | 'no-messages' | 'no-unread' | 'no-search-results' | 'error';
  onRetry?: () => void;
}

export default function EmptyStates({ type, onRetry }: Props) {
  if (type === 'no-messages') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 h-full">
        <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mb-4 border border-[#1e2d4d]">
          <i className="ri-message-3-line text-3xl text-slate-500"></i>
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No messages yet</h3>
        <p className="text-xs text-slate-500 mb-5 max-w-xs leading-relaxed">
          Messages from guards appear here after you post a job and receive applicants. You can also start a conversation from a guard's profile.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link href="/client/post-job">
            <button className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer text-sm whitespace-nowrap">
              <i className="ri-add-circle-line" />
              Post a Job
            </button>
          </Link>
          <Link href="/client/support">
            <button className="w-full flex items-center justify-center gap-2 bg-[#162036] text-slate-300 font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer text-sm whitespace-nowrap border border-[#1e2d4d]">
              <i className="ri-customer-service-2-line" />
              Contact Support
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 h-full">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
          <i className="ri-error-warning-line text-3xl text-red-400"></i>
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Failed to load messages</h3>
        <p className="text-xs text-slate-500 mb-5 max-w-xs">
          We could not load your messages. Check your connection and try again.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 bg-[#162036] text-teal-400 font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer text-sm whitespace-nowrap border border-[#1e2d4d]"
            >
              <i className="ri-refresh-line" />
              Retry
            </button>
          )}
          <Link href="/client/support">
            <button className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 font-semibold px-4 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer text-sm whitespace-nowrap border border-red-500/25">
              <i className="ri-customer-service-2-line" />
              Contact Support
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (type === 'no-search-results') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 h-full">
        <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mb-4 border border-[#1e2d4d]">
          <i className="ri-search-line text-3xl text-slate-500"></i>
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No results found</h3>
        <p className="text-xs text-slate-500 mb-5 max-w-xs leading-relaxed">
          Try adjusting your search or filters to find what you are looking for.
        </p>
      </div>
    );
  }

  const configs = {
    select: {
      icon: 'ri-chat-smile-3-line',
      title: 'Select a conversation',
      subtitle: 'Choose a conversation from the list to start messaging',
      color: 'text-slate-500',
      bg: 'bg-[#162036]',
    },
    'no-unread': {
      icon: 'ri-mail-check-line',
      title: 'All caught up',
      subtitle: 'You have no unread messages',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  };

  const config = configs[type as 'select' | 'no-unread'];
  if (!config) return null;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 h-full min-h-[300px]">
      <div className={`w-16 h-16 ${config.bg} rounded-2xl flex items-center justify-center mb-4 border border-[#1e2d4d]`}>
        <i className={`${config.icon} text-3xl ${config.color}`}></i>
      </div>
      <p className="text-sm font-semibold text-slate-400">{config.title}</p>
      <p className="text-xs text-slate-600 mt-1 max-w-xs">{config.subtitle}</p>
    </div>
  );
}