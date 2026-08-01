'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import PortalSidebar from '@/components/PortalSidebar';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import Link from 'next/link';
import { canSendJobMessage } from '@/lib/message-permissions';

interface ClientInfo {
  id: string;
  company_name: string;
  contact_name: string;
  user_id: string;
}

interface JobInfo {
  id: string;
  job_title: string;
  venue_city: string;
  status: string;
  start_date: string;
  start_time: string;
}

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
  other_name: string;
  other_avatar: string | null;
  other_initials: string;
  job_title: string | null;
  job_city: string | null;
  job_status: string | null;
  last_message: string;
  last_time: string;
  unread_count: number;
  status: string;
  is_support: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

export default function GuardMessagesClient() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();

  const [loading, setLoading] = useState(true);
  const [guardUserId, setGuardUserId] = useState('');
  const [guardName, setGuardName] = useState('Guard');
  const [guardInitials, setGuardInitials] = useState('GU');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [activeJob, setActiveJob] = useState<JobInfo | null>(null);
  const [activeClient, setActiveClient] = useState<ClientInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'job' | 'unread' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [input, setInput] = useState('');
  const [archivedConvIds, setArchivedConvIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const loadConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/guard/login'); return; }
      setGuardUserId(user.id);

      const { data: guard } = await supabase
        .from('guards')
        .select('full_name, profile_image_url')
        .eq('user_id', user.id)
        .maybeSingle();

      const name = guard?.full_name || 'Guard';
      setGuardName(name);
      setGuardInitials(getInitials(name));

      const savedArchived = localStorage.getItem(`quickguard_archived_guard_${user.id}`);
      if (savedArchived) {
        try {
          setArchivedConvIds(new Set(JSON.parse(savedArchived)));
        } catch {}
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      const grouped: Record<string, { messages: Message[]; job_id: string | null; other_user_id: string }> = {};
      for (const msg of messages) {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const key = msg.job_id ? `${msg.job_id}_${otherId}` : `${otherId}`;
        if (!grouped[key]) {
          grouped[key] = { messages: [], job_id: msg.job_id, other_user_id: otherId };
        }
        grouped[key].messages.push(msg);
      }

      const otherUserIds = [...new Set(Object.values(grouped).map(g => g.other_user_id))];
      const jobIds = [...new Set(Object.values(grouped).map(g => g.job_id).filter(Boolean))];

      const { data: clients } = await supabase
        .from('clients')
        .select('user_id, company_name, contact_name')
        .in('user_id', otherUserIds);

      const { data: jobs } = jobIds.length > 0
        ? await supabase.from('jobs').select('id, job_title, venue_city, status, start_date, start_time').in('id', jobIds)
        : { data: [] };

      const clientMap: Record<string, ClientInfo> = {};
      (clients || []).forEach(c => { if (c.user_id) clientMap[c.user_id] = c; });

      const jobMap: Record<string, JobInfo> = {};
      (jobs || []).forEach(j => { jobMap[j.id] = j; });

      const convs: Conversation[] = Object.entries(grouped).map(([key, group]) => {
        const client = clientMap[group.other_user_id];
        const job = group.job_id ? jobMap[group.job_id] : null;
        const lastMsg = group.messages[0];
        const unread = group.messages.filter(m => m.receiver_id === user.id && !m.read).length;
        const isSupport = lastMsg.sender_type === 'admin' || lastMsg.receiver_type === 'admin' || lastMsg.sender_type === 'support' || lastMsg.receiver_type === 'support';
        const name = client?.company_name || client?.contact_name || 'Unknown';

        return {
          id: key,
          job_id: group.job_id,
          other_user_id: group.other_user_id,
          other_name: name,
          other_avatar: null,
          other_initials: getInitials(name),
          job_title: job?.job_title || null,
          job_city: job?.venue_city || null,
          job_status: job?.status || null,
          last_message: lastMsg.message_text || '',
          last_time: lastMsg.created_at,
          unread_count: unread,
          status: 'Open',
          is_support: isSupport,
        };
      });

      convs.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());

      if (mountedRef.current) {
        setConversations(convs);
        setTotalUnread(convs.reduce((sum, c) => sum + c.unread_count, 0));
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    loadConversations();
    return () => { mountedRef.current = false; };
  }, [loadConversations]);

  useEffect(() => {
    if (!guardUserId) return;
    const channel = supabase
      .channel(`guard-messages-${guardUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'messages', filter: `receiver_id=eq.${guardUserId}` }, (payload) => {
        if (!mountedRef.current) return;
        const newMsg = payload.new as Message;
        loadConversations();
        setActiveMessages(prev => {
          if (prev.length === 0) return prev;
          const first = prev[0];
          const otherId = newMsg.sender_id === guardUserId ? newMsg.receiver_id : newMsg.sender_id;
          const firstOther = first.sender_id === guardUserId ? first.receiver_id : first.sender_id;
          if (firstOther !== otherId) return prev;
          if (newMsg.job_id && first.job_id !== newMsg.job_id) return prev;
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'messages', filter: `receiver_id=eq.${guardUserId}` }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guardUserId, loadConversations]);

  // Auto-scroll to latest message when new message arrives
  useEffect(() => {
    if (activeMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const loadActiveMessages = useCallback(async () => {
    if (!activeConversation || !guardUserId) return;

    let query = supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${guardUserId},receiver_id.eq.${guardUserId}`)
      .order('created_at', { ascending: true });

    if (activeConversation.job_id) {
      query = query.eq('job_id', activeConversation.job_id);
    } else {
      query = query.is('job_id', null);
    }

    const { data } = await query;
    const filtered = (data || []).filter(m => {
      const otherId = m.sender_id === guardUserId ? m.receiver_id : m.sender_id;
      return otherId === activeConversation.other_user_id;
    });

    setActiveMessages(filtered);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    if (activeConversation.job_id) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, job_title, venue_city, status, start_date, start_time')
        .eq('id', activeConversation.job_id)
        .maybeSingle();
      if (jobData) setActiveJob(jobData);
    } else {
      setActiveJob(null);
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('id, company_name, contact_name, user_id')
      .eq('user_id', activeConversation.other_user_id)
      .maybeSingle();
    if (clientData) setActiveClient(clientData);

    const unreadIds = filtered.filter(m => m.receiver_id === guardUserId && !m.read).map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, unread_count: 0 } : c));
      setTotalUnread(prev => Math.max(0, prev - unreadIds.length));
    }
  }, [activeConversation, activeConversationId, guardUserId]);

  useEffect(() => {
    if (activeConversationId) {
      setActiveMessages([]);
      loadActiveMessages();
    }
  }, [activeConversationId]);

  const handleSend = async () => {
    if (!activeConversation || !guardUserId || !input.trim()) return;
    setSending(true);
    try {
      if (activeConversation.job_id) {
        const perm = await canSendJobMessage({
          currentUserId: guardUserId,
          currentUserType: 'guard',
          jobId: activeConversation.job_id,
          otherUserId: activeConversation.other_user_id,
          otherUserType: 'client',
        });
        if (!perm.allowed) {
          setToast(perm.error || 'You do not have permission to message this client for this job.');
          setTimeout(() => setToast(''), 4000);
          setSending(false);
          return;
        }
      }
      const { error } = await supabase.from('messages').insert({
        sender_id: guardUserId,
        sender_type: 'guard',
        receiver_id: activeConversation.other_user_id,
        receiver_type: activeConversation.is_support ? 'support' : 'client',
        message_text: input.trim(),
        job_id: activeConversation.job_id,
        read: false,
      });
      if (error) throw error;
      try {
        const jobTitle = activeConversation.job_title;
        await supabase.from('notifications').insert({
          user_id: activeConversation.other_user_id,
          user_type: 'client',
          type: 'message',
          title: 'New message',
          message: `New message from guard${jobTitle ? ` for "${jobTitle}"` : ''}`,
          link: '/client/messages',
          is_read: false,
        });
      } catch (notifyErr) {
        console.error('Failed to create notification:', notifyErr);
      }
      setInput('');
      await loadActiveMessages();
      await loadConversations();
    } catch {
      setToast('Failed to send message. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (filter === 'archived') return archivedConvIds.has(c.id);
    if (filter === 'job') return c.job_id !== null && !archivedConvIds.has(c.id);
    if (filter === 'unread') return c.unread_count > 0 && !archivedConvIds.has(c.id);
    return !archivedConvIds.has(c.id);
  }).filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.other_name.toLowerCase().includes(q) || (c.job_title && c.job_title.toLowerCase().includes(q)) || c.last_message.toLowerCase().includes(q);
  });

  const groupedMessages: { date: string; items: Message[] }[] = [];
  let currentDate = '';
  for (const msg of activeMessages) {
    const dateLabel = formatDate(msg.created_at);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      groupedMessages.push({ date: dateLabel, items: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].items.push(msg);
    }
  }

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar role="guard" displayName={guardName} subtitle="Guard" initials={guardInitials} accentColor="emerald" />

      <div className="flex-1 lg:ml-72 min-h-screen flex flex-col lg:flex-row pb-20 lg:pb-0">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#111d35] border border-[#1e2d4d] rounded-xl px-4 py-3 shadow-lg flex items-center gap-2">
            <i className="ri-information-line text-teal-400"></i>
            <span className="text-sm text-slate-300">{toast}</span>
            <button onClick={() => setToast('')} className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 cursor-pointer">
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>
        )}

        {/* Conversation List */}
        <div className={`w-full lg:w-[420px] flex-shrink-0 border-r border-[#1e2d4d] flex flex-col pb-20 lg:pb-0 ${mobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-5 py-3 border-b border-[#1e2d4d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Messages</h2>
              {totalUnread > 0 && (
                <span className="bg-teal-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-b border-[#1e2d4d]">
            <div className="relative mb-3">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#162036] border border-[#1e2d4d] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { key: 'all', label: 'All', icon: 'ri-message-3-line' },
                { key: 'job', label: 'Jobs', icon: 'ri-briefcase-line' },
                { key: 'unread', label: 'Unread', icon: 'ri-mail-unread-line' },
                { key: 'archived', label: 'Archived', icon: 'ri-archive-line' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as 'all' | 'job' | 'unread' | 'archived')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${filter === f.key ? 'bg-teal-500 text-slate-900' : 'bg-[#162036] text-slate-400 hover:text-slate-200 border border-[#1e2d4d]'}`}
                >
                  <i className={f.icon}></i>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-11 h-11 bg-[#162036] rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[#162036] rounded w-32" />
                      <div className="h-3 bg-[#162036] rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 bg-[#162036] rounded-2xl flex items-center justify-center mb-3 border border-[#1e2d4d]">
                  <i className={`${filter === 'archived' ? 'ri-archive-line' : searchQuery ? 'ri-search-line' : 'ri-message-3-line'} text-2xl text-slate-600`}></i>
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {searchQuery ? 'No search results' : filter === 'archived' ? 'No archived conversations' : filter === 'unread' ? 'No unread messages' : 'No messages yet'}
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-[260px]">
                  {searchQuery
                    ? 'Try a different search term.'
                    : filter === 'archived'
                    ? 'Archive conversations to view them here.'
                    : filter === 'unread'
                    ? 'All caught up!'
                    : 'Start a conversation from a job you have applied to or been assigned to.'}
                </p>
                {!searchQuery && filter !== 'archived' && (
                  <Link
                    href="/guard/jobs"
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#162036] text-teal-400 text-sm font-medium rounded-xl border border-[#1e2d4d] hover:border-teal-500/20 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-briefcase-line"></i>
                    Browse Jobs
                  </Link>
                )}
              </div>
            ) : (
              <ul>
                {filteredConversations.map((conv) => (
                  <li
                    key={conv.id}
                    onClick={() => { setActiveConversationId(conv.id); setMobileChatOpen(true); }}
                    className={`flex items-start gap-3 px-5 py-4 border-b border-[#1e2d4d] cursor-pointer transition-colors ${activeConversationId === conv.id ? 'bg-[#162036]' : conv.unread_count > 0 ? 'bg-teal-500/5 hover:bg-teal-500/10' : 'hover:bg-[#162036]/50'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
                        <span className="text-teal-400 font-bold text-xs">{conv.other_initials}</span>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-teal-500 text-slate-900 text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0B1933]">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? 'text-white' : 'text-slate-300'}`}>{conv.other_name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${conv.is_support ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'}`}>
                            {conv.is_support ? 'Support' : 'Client'}
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

                      <p className={`text-xs mt-1 leading-relaxed truncate ${conv.unread_count > 0 ? 'text-slate-200' : 'text-slate-500'}`}>{conv.last_message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className={`flex-1 flex flex-col pb-20 lg:pb-0 ${mobileChatOpen ? 'flex' : 'hidden lg:flex'}`}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e2d4d] bg-[#111d35]">
                <button
                  onClick={() => { setMobileChatOpen(false); setActiveConversationId(null); }}
                  className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line text-base"></i>
                </button>
                <div className="w-10 h-10 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
                  <span className="text-teal-400 font-bold text-xs">{activeConversation.other_initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{activeConversation.other_name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeConversation.is_support ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'}`}>
                    {activeConversation.is_support ? 'Support' : 'Client'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const newArchived = new Set(archivedConvIds);
                    if (newArchived.has(activeConversation.id)) {
                      newArchived.delete(activeConversation.id);
                      setToast('Conversation unarchived');
                    } else {
                      newArchived.add(activeConversation.id);
                      setToast('Conversation archived');
                    }
                    setArchivedConvIds(newArchived);
                    localStorage.setItem(`quickguard_archived_guard_${guardUserId}`, JSON.stringify([...newArchived]));
                    setTimeout(() => setToast(''), 3000);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-teal-400 px-2 py-1 rounded-lg border border-[#1e2d4d] hover:border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap"
                  title={archivedConvIds.has(activeConversation.id) ? 'Unarchive conversation' : 'Archive conversation'}
                >
                  <i className={`${archivedConvIds.has(activeConversation.id) ? 'ri-inbox-unarchive-line' : 'ri-archive-line'} mr-1`}></i>
                  {archivedConvIds.has(activeConversation.id) ? 'Unarchive' : 'Archive'}
                </button>
              </div>

              {/* Job Context */}
              {activeJob && (
                <div className="px-5 py-3 bg-[#111d35] border-b border-[#1e2d4d]">
                  <div className="flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
                    <div className="w-9 h-9 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ri-briefcase-line text-teal-400 text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{activeJob.job_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1"><i className="ri-map-pin-line"></i>{activeJob.venue_city || '—'}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1"><i className="ri-calendar-line"></i>{activeJob.start_date ? new Date(activeJob.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{activeJob.status?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                {activeMessages.length === 0 ? (
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
                        <span className="text-[11px] text-slate-500 bg-[#162036] px-3 py-1 rounded-full border border-[#1e2d4d]">{group.date}</span>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((msg) => {
                          const guardSent = msg.sender_id === guardUserId;
                          return (
                            <div key={msg.id} className={`flex ${guardSent ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex items-end gap-2 max-w-[75%] ${guardSent ? 'flex-row-reverse' : 'flex-row'}`}>
                                {!guardSent && (
                                  <div className="w-7 h-7 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 border border-[#1e2d4d] mb-1">
                                    <span className="text-teal-400 font-bold text-[10px]">{activeConversation.other_initials}</span>
                                  </div>
                                )}
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${guardSent ? 'bg-teal-500 text-white rounded-br-md' : 'bg-[#162036] text-slate-200 border border-[#1e2d4d] rounded-bl-md'}`}>
                                  <p>{msg.message_text}</p>
                                  <p className={`text-[10px] mt-1 ${guardSent ? 'text-teal-100' : 'text-slate-500'}`}>
                                    {formatTime(msg.created_at)}
                                    {guardSent && <span className="ml-1.5 inline-flex items-center gap-0.5"><i className={`${msg.read ? 'ri-check-double-line' : 'ri-check-line'} text-[10px]`}></i></span>}
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

              {/* Input */}
              <div className="px-4 py-3 bg-[#111d35] border-t border-[#1e2d4d]">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      maxLength={1000}
                      className="w-full bg-[#162036] border border-[#1e2d4d] rounded-xl pl-4 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">{input.length}/1000</span>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="w-10 h-10 flex items-center justify-center bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                  >
                    {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="ri-send-plane-fill text-base"></i>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mb-4 border border-[#1e2d4d]">
                  <i className="ri-message-3-line text-3xl text-slate-600"></i>
                </div>
                <p className="text-sm font-semibold text-slate-400">Select a conversation</p>
                <p className="text-xs text-slate-600 mt-1">Choose a conversation from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}