'use client';

import { useState, useRef, useEffect } from 'react';
import MessageTemplates from './MessageTemplates';

interface Message {
  id: string;
  job_id: string | null;
  sender_id: string;
  receiver_id: string;
  sender_type: string;
  receiver_type: string;
  message_text: string;
  read: boolean;
  created_at: string;
}

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

interface JobInfo {
  id: string;
  job_title: string;
  venue_city: string;
  status: string;
  start_date: string;
  start_time: string;
}

interface GuardInfo {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
}

interface Props {
  conversation: Conversation;
  messages: Message[];
  job: JobInfo | null;
  guard: GuardInfo | null;
  clientUserId: string;
  sending: boolean;
  onSend: (text: string) => void;
  onBack: () => void;
  messagesEndRef: any;
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChatPanel({
  conversation,
  messages,
  job,
  guard,
  clientUserId,
  sending,
  onSend,
  onBack,
  messagesEndRef,
  hasOlderMessages,
  loadingOlder,
  onLoadOlder,
  isArchived,
  onArchive,
  onUnarchive,
}: Props) {
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isClient = (senderId: string) => senderId === clientUserId;

  const handleSend = () => {
    if (!input.trim()) {
      setError('Please enter a message');
      return;
    }
    if (input.length > 1000) {
      setError('Message too long (max 1000 characters)');
      return;
    }
    setError('');
    onSend(input.trim());
    setInput('');
    setShowTemplates(false);
  };

  const handleTemplateSelect = (text: string) => {
    setInput(text);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages: { date: string; items: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      groupedMessages.push({ date: dateLabel, items: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].items.push(msg);
    }
  }

  // Auto-scroll when new message arrives
  const prevLastIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== prevLastIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevLastIdRef.current = lastMsg.id;
    }
  }, [messages]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-emerald-500/15 text-emerald-400';
      case 'active': return 'bg-blue-500/15 text-blue-400';
      case 'completed': return 'bg-slate-500/15 text-slate-400';
      case 'awaiting_payment': return 'bg-amber-500/15 text-amber-400';
      case 'awaiting_guard_selection': return 'bg-violet-500/15 text-violet-400';
      default: return 'bg-slate-500/15 text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1933]">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e2d4d] bg-[#111d35]">
        <button
          onClick={onBack}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-line text-base"></i>
        </button>

        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
            {conversation.other_avatar ? (
              <img src={conversation.other_avatar} alt={conversation.other_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-teal-400 font-bold text-xs">{conversation.other_initials}</span>
            )}
          </div>
          {conversation.is_support && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center border-2 border-[#111d35]">
              <i className="ri-customer-service-2-line text-[8px] text-white"></i>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">{conversation.other_name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              conversation.is_support
                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                : 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
            }`}>
              {conversation.is_support ? 'Support' : 'Guard'}
            </span>
          </div>
          {conversation.other_rating !== null && (
            <div className="flex items-center gap-1">
              <i className="ri-star-fill text-amber-400 text-[10px]"></i>
              <span className="text-[11px] text-slate-500">{conversation.other_rating}/5</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(isArchived ? onUnarchive : onArchive) && (
            <button
              onClick={isArchived ? onUnarchive : onArchive}
              className="text-xs font-semibold text-slate-400 hover:text-teal-400 px-2 py-1 rounded-lg border border-[#1e2d4d] hover:border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap"
              title={isArchived ? 'Unarchive conversation' : 'Archive conversation'}
            >
              <i className={`${isArchived ? 'ri-inbox-unarchive-line' : 'ri-archive-line'} mr-1`}></i>
              {isArchived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              showTemplates ? 'bg-teal-500/15 text-teal-400' : 'bg-[#162036] text-slate-400 hover:text-slate-200'
            }`}
            title="Message templates"
          >
            <i className="ri-flashlight-line text-base"></i>
          </button>
        </div>
      </div>

      {job && (
        <div className="px-5 py-3 bg-[#111d35] border-b border-[#1e2d4d]">
          <div className="flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
            <div className="w-9 h-9 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-briefcase-line text-teal-400 text-base"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{job.job_title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <i className="ri-map-pin-line"></i>
                  {job.venue_city || '—'}
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <i className="ri-calendar-line"></i>
                  {job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor(job.status)}`}>
                  {job.status?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="border-b border-[#1e2d4d]">
          <MessageTemplates onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {hasOlderMessages && (
          <div className="flex justify-center mb-2">
            <button
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl bg-[#162036] hover:bg-[#1a2642] transition-colors border border-[#1e2d4d] cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {loadingOlder ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <i className="ri-arrow-up-line"></i>
                  Load older messages
                </span>
              )}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mb-3 border border-[#1e2d4d]">
              <i className="ri-chat-3-line text-xl text-slate-600"></i>
            </div>
            <p className="text-sm text-slate-500 font-medium">No messages yet</p>
            <p className="text-xs text-slate-600 mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center mb-4">
                <span className="text-[11px] text-slate-500 bg-[#162036] px-3 py-1 rounded-full border border-[#1e2d4d]">
                  {group.date}
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map((msg) => {
                  const clientSent = isClient(msg.sender_id);
                  return (
                    <div key={msg.id} className={`flex ${clientSent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end gap-2 max-w-[75%] ${clientSent ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!clientSent && (
                          <div className="w-7 h-7 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 border border-[#1e2d4d] mb-1">
                            {conversation.other_avatar ? (
                              <img src={conversation.other_avatar} alt={conversation.other_name} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <span className="text-teal-400 font-bold text-[10px]">{conversation.other_initials}</span>
                            )}
                          </div>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          clientSent
                            ? 'bg-teal-500 text-white rounded-br-md'
                            : 'bg-[#162036] text-slate-200 border border-[#1e2d4d] rounded-bl-md'
                        }`}>
                          <p>{msg.message_text}</p>
                          <p className={`text-[10px] mt-1 ${clientSent ? 'text-teal-100' : 'text-slate-500'}`}>
                            {formatTime(msg.created_at)}
                            {clientSent && (
                              <span className="ml-1.5 flex items-center gap-0.5 inline-flex">
                                <i className={`${msg.read ? 'ri-check-double-line' : 'ri-check-line'} text-[10px]`}></i>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 bg-[#111d35] border-t border-[#1e2d4d]">
        {error && (
          <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <i className="ri-error-warning-line"></i>
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={1000}
              className="w-full bg-[#162036] border border-[#1e2d4d] rounded-xl pl-4 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
              {input.length}/1000
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="w-10 h-10 flex items-center justify-center bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="ri-send-plane-fill text-base"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}