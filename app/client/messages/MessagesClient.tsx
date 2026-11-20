'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { withRequestDeadline } from '@/lib/request-deadline';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import ConversationList from './ConversationList';
import ChatPanel from './ChatPanel';
import EmptyStates from './EmptyStates';
import BulkActionBar from '../components/BulkActionBar';
import { readMessageRows, readMessagePartners, messageHistoryPage, sendJobMessage, changeJobMessages } from '@/lib/job-messages';
import { useMessageOwner } from '@/hooks/useMessageOwner';

interface GuardInfo {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
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

interface PartnerProfile {
  full_name: string;
  avatar: string | null;
  rating: number | null;
  type: 'guard' | 'admin' | 'support' | 'unknown';
}

const MSG_PAGE_SIZE = 40;

const MESSAGE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'unread_first', label: 'Unread First' },
  { value: 'oldest', label: 'Oldest' },
];

const MESSAGE_FILTER_CONFIGS = [
  {
    key: 'type',
    label: 'Type',
    type: 'select' as const,
    options: [
      { value: 'job', label: 'Job Related' },
      { value: 'guard', label: 'Guard Chat' },
      { value: 'support', label: 'Support' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'unread', label: 'Unread' },
      { value: 'read', label: 'Read' },
    ],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function MessagesClient() {
  const actor = useMessageOwner();
  if (!actor.ready) return <div role="status" className="p-8">Loading your message account…</div>;
  if (actor.error || !actor.id) return <div role="alert" className="p-8 space-y-4"><p>Your message account could not be verified.</p><button onClick={actor.retry}>Retry</button><a href="/client/login">Sign in</a></div>;
  return <ClientMessageInbox key={`${actor.id}:${actor.revision}`} expectedOwner={actor.id} />;
}
function ClientMessageInbox({ expectedOwner }: { expectedOwner: string }) {
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [clientUserId, setClientUserId] = useState('');
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Basic');
  const [initials, setInitials] = useState('CL');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convHasMore, setConvHasMore] = useState(false);
  const [convLoadingMore, setConvLoadingMore] = useState(false);
  const convNextOffsetRef = useRef(0);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [msgLoadingOlder, setMsgLoadingOlder] = useState(false);
  const [msgOldestCreatedAt, setMsgOldestCreatedAt] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<JobInfo | null>(null);
  const [activeGuard, setActiveGuard] = useState<GuardInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'job' | 'guard' | 'support' | 'unread' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [archivedConvIds, setArchivedConvIds] = useState<Set<string>>(new Set());
  const skipScrollRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const conversationRequestRef = useRef(0);
  const latestActiveLoadRef = useRef<() => Promise<void>>(async () => {});
  const sendLockRef = useRef(false);
  const bulkLockRef = useRef(false);
  const [messageError, setMessageError] = useState('');

  // Resolve partner profile from guards, admin_users or users tables
  const resolvePartner = useCallback(async (
    userIds: string[],
    senderTypes: Record<string, string>
  ): Promise<Record<string, PartnerProfile>> => {
    const result: Record<string, PartnerProfile> = {};
    if (userIds.length === 0) return result;

    const profiles = await readMessagePartners(supabase, expectedOwner, userIds, () => mountedRef.current);
    const guardMap: Record<string, any> = {}, adminMap: Record<string, any> = {};
    for (const profile of profiles) {
      if (profile.user_type === 'guard') guardMap[profile.user_id] = profile;
      if (profile.user_type === 'admin' || profile.user_type === 'support') adminMap[profile.user_id] = profile;
    }

    for (const uid of userIds) {
      const guard = guardMap[uid];
      const admin = adminMap[uid];
      const senderType = senderTypes[uid] || '';
      const isSupport = senderType === 'admin' || senderType === 'support';

      if (guard) {
        result[uid] = { full_name: guard.full_name, avatar: guard.profile_image_url, rating: guard.rating, type: 'guard' };
      } else if (admin || isSupport) {
        result[uid] = { full_name: admin?.full_name || 'QuickGuard Support', avatar: null, rating: null, type: 'admin' };
      } else {
        result[uid] = { full_name: 'Unknown', avatar: null, rating: null, type: 'unknown' };
      }
    }
    return result;
  }, [expectedOwner]);

  const buildConversations = useCallback(async (
    messages: Message[],
    userId: string
  ): Promise<Conversation[]> => {
    const grouped: Record<string, { messages: Message[]; job_id: string | null; other_user_id: string; sender_type_by_partner: string }> = {};

    for (const msg of messages) {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const key = msg.job_id ? `${msg.job_id}_${otherId}` : `${otherId}`;
      if (!grouped[key]) {
        grouped[key] = { messages: [], job_id: msg.job_id, other_user_id: otherId, sender_type_by_partner: '' };
      }
      grouped[key].messages.push(msg);
      if (msg.sender_id === otherId && !grouped[key].sender_type_by_partner) {
        grouped[key].sender_type_by_partner = msg.sender_type;
      }
    }

    const otherUserIds = [...new Set(Object.values(grouped).map(g => g.other_user_id))];
    const jobIds = [...new Set(Object.values(grouped).map(g => g.job_id).filter(Boolean))] as string[];

    const senderTypeByUid: Record<string, string> = {};
    Object.values(grouped).forEach(g => {
      if (!senderTypeByUid[g.other_user_id]) senderTypeByUid[g.other_user_id] = g.sender_type_by_partner;
    });

    const [partnerMap, jobRes] = await Promise.all([
      resolvePartner(otherUserIds, senderTypeByUid),
      jobIds.length > 0
        ? withRequestDeadline(supabase.from('jobs').select('id, job_title, venue_city, status, start_date, start_time').in('id', jobIds))
        : Promise.resolve({ data: [] as JobInfo[], error: null }),
    ]);

    if (jobRes.error) throw jobRes.error;
    const jobMap: Record<string, JobInfo> = {};
    (jobRes.data || []).forEach((j: JobInfo) => { jobMap[j.id] = j; });

    const convs: Conversation[] = Object.entries(grouped).map(([key, group]) => {
      const partner = partnerMap[group.other_user_id];
      const job = group.job_id ? jobMap[group.job_id] : null;
      const lastMsg = group.messages[0];
      const unread = group.messages.filter(m => m.receiver_id === userId && !m.read).length;
      const isSupport = partner?.type === 'admin' || lastMsg.sender_type === 'admin' || lastMsg.sender_type === 'support' || lastMsg.receiver_type === 'admin' || lastMsg.receiver_type === 'support';
      const name = partner?.full_name || 'Unknown';

      return {
        id: key,
        job_id: group.job_id,
        other_user_id: group.other_user_id,
        other_type: partner?.type || 'unknown',
        other_name: name,
        other_avatar: partner?.avatar || null,
        other_initials: getInitials(name),
        other_rating: partner?.rating || null,
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
    return convs;
  }, [resolvePartner]);

  const loadConversations = useCallback(async () => {
    const request = ++conversationRequestRef.current;
    const current = () => mountedRef.current && conversationRequestRef.current === request;
    setLoadError(false); setLoading(true);
    try {
      const auth = await withRequestDeadline(supabase.auth.getUser());
      if (!current()) return;
      if (auth.error || auth.data.user?.id !== expectedOwner) throw new Error('Account changed');
      const profile = await withRequestDeadline(supabase.from('clients').select('id, company_name, contact_name, subscription_tier').eq('user_id', expectedOwner).maybeSingle());
      if (!current()) return;
      if (profile.error || !profile.data) throw new Error('Client profile unavailable');
      const messages = await readMessageRows(supabase, expectedOwner, undefined, current);
      const convs = await buildConversations(messages, expectedOwner);
      if (!current()) return;
      setClientUserId(expectedOwner); setCompanyName(profile.data.company_name || 'Client');
      setSubscriptionTier(profile.data.subscription_tier || 'Basic'); setInitials(getInitials(profile.data.company_name || 'Client'));
      const archived = localStorage.getItem(`quickguard_archived_client_${expectedOwner}`);
      try { setArchivedConvIds(new Set(archived ? JSON.parse(archived) : [])); } catch { setArchivedConvIds(new Set()); }
      setConversations(convs); setConvHasMore(false); convNextOffsetRef.current = messages.length;
      setTotalUnread(convs.reduce((sum, c) => sum + c.unread_count, 0));
    } catch { if (current()) setLoadError(true); }
    finally { if (current()) { setLoading(false); setConvLoadingMore(false); } }
  }, [expectedOwner, buildConversations]);

  const refreshConversationsAndActive = useCallback(async () => {
    if (!mountedRef.current) return;
    await loadConversations();
    if (mountedRef.current) void latestActiveLoadRef.current();
  }, [loadConversations]);

  useEffect(() => {
    mountedRef.current = true;
    loadConversations();
    return () => { mountedRef.current = false; };
  }, [loadConversations]);

  useEffect(() => {
    if (!clientUserId) return;

    const channel = supabase
      .channel(`client-messages-app-${clientUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'app',
        table: 'messages',
        filter: `receiver_id=eq.${clientUserId}`,
      }, () => {
        if (!mountedRef.current) return;
        refreshConversationsAndActive();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'app',
        table: 'messages',
        filter: `sender_id=eq.${clientUserId}`,
      }, () => {
        if (!mountedRef.current) return;
        refreshConversationsAndActive();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'app', table: 'messages', filter: `sender_id=eq.${clientUserId}`,
      }, payload => {
        if (!mountedRef.current) return;
        const updated = payload.new as Message;
        setActiveMessages(previous => previous.map(row => row.id === updated.id ? updated : row));
        void loadConversations();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'app',
        table: 'messages',
        filter: `receiver_id=eq.${clientUserId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        const updated = payload.new as Message;
        setActiveMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        void loadConversations();
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
        else setRealtimeStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [clientUserId, refreshConversationsAndActive, loadConversations]);

  // Older-page inserts must not scroll away from the history being read.
  const lastMessageId = activeMessages[activeMessages.length - 1]?.id;
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (msgLoadingOlder) return;
    const hasNewLastMessage = previousLastMessageIdRef.current !== lastMessageId;
    previousLastMessageIdRef.current = lastMessageId;
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    if (lastMessageId && hasNewLastMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lastMessageId, msgLoadingOlder]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Depend on conversation identity, not list objects replaced by unread/realtime updates.
  const activeJobId = activeConversation?.job_id ?? null;
  const activeOtherUserId = activeConversation?.other_user_id ?? null;
  const messageContextKey = JSON.stringify([activeConversationId, activeJobId, activeOtherUserId, clientUserId]);
  const messageLifetimeRef = useRef<{ key: string } | null>(null);
  const messageRequestRef = useRef(0);

  const loadActiveMessages = useCallback(async (beforeCreatedAt?: string) => {
    const lifetime = messageLifetimeRef.current;
    if (!activeConversationId || !activeOtherUserId || !clientUserId || !lifetime || lifetime.key !== messageContextKey) return;
    const request = ++messageRequestRef.current;
    const isCurrent = () => messageLifetimeRef.current === lifetime && messageRequestRef.current === request;

    const isLoadMore = !!beforeCreatedAt;
    if (isLoadMore) setMsgLoadingOlder(true);
    try {
      setMessageError('');
      const rows = await readMessageRows(supabase, clientUserId, { other: activeOtherUserId, job: activeJobId }, isCurrent);
      if (!isCurrent()) return;
      const page = messageHistoryPage(rows, beforeCreatedAt, MSG_PAGE_SIZE);
      if (isLoadMore) { skipScrollRef.current = true; setActiveMessages(previous => [...page.messages.filter(row => !previous.some(p => p.id === row.id)), ...previous]); }
      else setActiveMessages(page.messages);
      setMsgHasMore(page.hasMore); setMsgOldestCreatedAt(page.cursor);
      if (!activeJobId) setActiveJob(null);
      else if (!isLoadMore) {
        const result = await withRequestDeadline(supabase.from('jobs').select('id, job_title, venue_city, status, start_date, start_time').eq('id', activeJobId).maybeSingle());
        if (!isCurrent()) return; if (result.error) throw result.error; setActiveJob(result.data);
      }
      setActiveGuard(null);
      if (!isLoadMore) {
        const unread = page.messages.filter(row => row.receiver_id === clientUserId && !row.read).map(row => row.id);
        if (unread.length) {
          const result = await changeJobMessages(supabase, clientUserId, unread, 'read', isCurrent);
          if (!isCurrent()) return;
          if (!result.complete) throw new Error('Read acknowledgement incomplete');
          setActiveMessages(previous => previous.map(row => result.confirmedIds.includes(row.id) ? { ...row, read: true } : row));
          await loadConversations();
        }
      }
    } catch {
      if (isCurrent()) setMessageError('This conversation could not be loaded or its read state confirmed. Reload to retry.');

    } finally {
      if (isLoadMore && isCurrent()) setMsgLoadingOlder(false);
    }
  }, [activeJobId, activeOtherUserId, activeConversationId, clientUserId, messageContextKey, loadConversations]);

  useEffect(() => { latestActiveLoadRef.current = loadActiveMessages; }, [loadActiveMessages]);

  useEffect(() => {
    const lifetime = { key: messageContextKey };
    messageLifetimeRef.current = lifetime;
    setActiveMessages([]);
    setActiveJob(null);
    setActiveGuard(null);
    setMsgLoadingOlder(false);
    setMsgHasMore(false);
    setMsgOldestCreatedAt(null);
    if (activeConversationId) void loadActiveMessages();
    return () => { if (messageLifetimeRef.current === lifetime) messageLifetimeRef.current = null; };
  }, [activeConversationId, loadActiveMessages, messageContextKey]);

  const handleLoadOlderMessages = () => {
    if (msgOldestCreatedAt) loadActiveMessages(msgOldestCreatedAt);
  };

  const handleSend = async (text: string, operationId: string): Promise<boolean> => {
    const lifetime = messageLifetimeRef.current;
    const current = () => mountedRef.current && messageLifetimeRef.current === lifetime;
    if (!activeConversation || !clientUserId || !text.trim() || sendLockRef.current || loadError || messageError) return false;
    sendLockRef.current = true; setSending(true);
    try {
      await sendJobMessage(supabase, { id: operationId, owner: clientUserId, other: activeConversation.other_user_id, job: activeConversation.job_id, text }, current);
      if (!current()) return false;
      void loadActiveMessages(); return true;
    } catch { if (current()) setToast('Message save could not be confirmed. Your draft is retained; retry the same message.'); return false; }
    finally { if (current()) { sendLockRef.current = false; setSending(false); } }
  };

  const toggleConvSelection = (id: string) => { if (bulkLockRef.current || loadError) return; setSelectedConvIds(previous => { const next = new Set(previous); if(next.has(id))next.delete(id);else next.add(id);return next; }); };
  const selectAllConvs = () => setSelectedConvIds(new Set(filteredConversations.map(c => c.id)));
  const clearConvSelection = () => setSelectedConvIds(new Set());

  const runMessageBulk = async (action: 'read' | 'unread' | 'delete') => {
    if (bulkLockRef.current || loadError || sending) return;
    bulkLockRef.current = true; setBulkProcessing(true); setBulkAction(action === 'read' ? 'mark_read' : action === 'unread' ? 'mark_unread' : 'delete');
    const current = () => mountedRef.current;
    try {
      const all = await readMessageRows(supabase, clientUserId, undefined, current);
      const selected = conversations.filter(c => selectedConvIds.has(c.id));
      const ids = all.filter(row => selected.some(c => c.job_id === row.job_id && (row.sender_id === clientUserId ? row.receiver_id : row.sender_id) === c.other_user_id))
        .filter(row => action === 'delete' || row.receiver_id === clientUserId).map(row => row.id);
      if (!ids.length) { setToast('No eligible messages selected.'); return; }
      const result = await changeJobMessages(supabase, clientUserId, ids, action, current);
      if (!current()) return;
      if (result.complete) { setSelectedConvIds(new Set()); setBulkMode(false); setToast('Selected message changes confirmed.'); }
      else setToast('Some message changes were not confirmed. Reload before retrying.');
      await loadConversations();
      if (activeConversationId) void latestActiveLoadRef.current();
    } catch { if (current()) setToast('Message changes could not be confirmed. Reload before retrying.'); }
    finally { if (current()) { bulkLockRef.current = false; setBulkProcessing(false); setBulkAction(''); } }
  };
  const handleBulkMarkRead = () => runMessageBulk('read');
  const handleBulkMarkUnread = () => runMessageBulk('unread');

  const saveArchived = (next: Set<string>, message: string) => {
    try {
      localStorage.setItem(`quickguard_archived_client_${clientUserId}`, JSON.stringify([...next]));
      setArchivedConvIds(next); setToast(message); return true;
    } catch { setToast('Archive changes could not be saved. Please retry.'); return false; }
  };
  const handleBulkArchive = () => {
    const next = new Set(archivedConvIds); selectedConvIds.forEach(id => next.add(id));
    if (saveArchived(next, 'Conversations archived')) { setSelectedConvIds(new Set()); setBulkMode(false); }
  };
  const handleUnarchive = (id: string) => {
    const next = new Set(archivedConvIds); next.delete(id); saveArchived(next, 'Conversation unarchived');
  };

  const handleBulkDelete = () => runMessageBulk('delete');

  const handleMessageBulkAction = (actionKey: string) => {
    if (actionKey === 'mark_read') handleBulkMarkRead();
    else if (actionKey === 'mark_unread') handleBulkMarkUnread();
    else if (actionKey === 'archive') handleBulkArchive();
    else if (actionKey === 'delete') handleBulkDelete();
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileChatOpen(true);
  };

  const handleBackToList = () => {
    setMobileChatOpen(false);
    setActiveConversationId(null);
  };

  const filteredConversations = conversations.filter(c => {
    if (filter === 'archived') return archivedConvIds.has(c.id);
    if (filter === 'job') return c.job_id !== null && !archivedConvIds.has(c.id);
    if (filter === 'guard') return c.other_type === 'guard' && !archivedConvIds.has(c.id);
    if (filter === 'support') return c.is_support && !archivedConvIds.has(c.id);
    if (filter === 'unread') return c.unread_count > 0 && !archivedConvIds.has(c.id);
    return !archivedConvIds.has(c.id);
  }).filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.other_name.toLowerCase().includes(q) ||
      (c.job_title && c.job_title.toLowerCase().includes(q)) ||
      c.last_message.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'unread_first') {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
    }
    if (sortBy === 'oldest') {
      return new Date(a.last_time).getTime() - new Date(b.last_time).getTime();
    }
    return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
  });

  const handleClearFilters = () => {
    setFilter('all');
    setSearchQuery('');
    setSortBy('');
    setShowFilters(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'type') setFilter(value as 'all' | 'job' | 'guard' | 'support' | 'unread' | 'archived');
    else if (key === 'status') setFilter(value as 'all' | 'unread' | 'archived');
  };

  if (authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        {messageError && <div role="alert" className="fixed top-3 left-1/2 z-50 bg-red-950 text-white p-4 rounded-xl"><p>{messageError}</p><button onClick={() => void loadActiveMessages()} className="underline">Reload conversation</button></div>}
      <PortalSidebar role="client" displayName={companyName} subtitle={subscriptionTier} initials={initials} />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.direct_contact" />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        {messageError && <div role="alert" className="fixed top-3 left-1/2 z-50 bg-red-950 text-white p-4 rounded-xl"><p>{messageError}</p><button onClick={() => void loadActiveMessages()} className="underline">Reload conversation</button></div>}
      <PortalSidebar role="client" displayName={companyName} subtitle={subscriptionTier} initials={initials} />
        <div className="flex-1 min-h-screen flex flex-col lg:flex-row pb-20 lg:pb-0">
          <div className="w-full lg:w-[420px] flex-shrink-0 border-r border-[#1e2d4d] flex flex-col">
            <div className="px-4 sm:px-5 py-3 border-b border-[#1e2d4d] flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-6 sm:h-7 bg-[#162036] rounded w-28 sm:w-32" />
                <div className="h-5 bg-[#162036] rounded-full w-6" />
              </div>
              <div className="h-7 bg-[#162036] rounded-lg w-16" />
            </div>
            <div className="px-4 sm:px-5 py-3 border-b border-[#1e2d4d] animate-pulse">
              <div className="h-9 sm:h-10 bg-[#162036] rounded-xl w-full" />
            </div>
            <div className="px-4 sm:px-5 py-3 border-b border-[#1e2d4d] flex gap-2 animate-pulse flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 bg-[#162036] rounded-lg w-20 sm:w-24" />
              ))}
            </div>
            <div className="flex-1 divide-y divide-[#1e2d4d]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 sm:px-5 py-3 animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#162036] rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-4 bg-[#162036] rounded w-28 sm:w-36" />
                      <div className="h-3 bg-[#162036] rounded w-10 sm:w-12 flex-shrink-0" />
                    </div>
                    <div className="h-3 bg-[#162036] rounded w-full sm:w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex flex-1 flex-col">
            <div className="px-6 py-4 border-b border-[#1e2d4d] flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-[#162036] rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-[#162036] rounded w-32" />
                <div className="h-3 bg-[#162036] rounded w-24" />
              </div>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                  <div className={`bg-[#162036] rounded-xl p-3 max-w-[75%] ${i % 2 === 0 ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
                    <div className="h-3 bg-[#111d35] rounded w-40 sm:w-48 mb-2" />
                    <div className="h-3 bg-[#111d35] rounded w-24 sm:w-32" />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#1e2d4d] animate-pulse">
              <div className="h-10 bg-[#162036] rounded-xl w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      {messageError && <div role="alert" className="fixed top-3 left-1/2 z-50 bg-red-950 text-white p-4 rounded-xl"><p>{messageError}</p><button onClick={() => void loadActiveMessages()} className="underline">Reload conversation</button></div>}
      <PortalSidebar role="client" displayName={companyName} subtitle={subscriptionTier} initials={initials} />

      <div className="flex-1 min-h-screen flex flex-col lg:flex-row pb-20 lg:pb-0">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#111d35] border border-[#1e2d4d] rounded-xl px-4 py-3 shadow-lg flex items-center gap-2">
            <i className="ri-information-line text-teal-400"></i>
            <span className="text-sm text-slate-300">{toast}</span>
            <button onClick={() => setToast('')} className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 cursor-pointer">
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>
        )}

        <div className={`w-full lg:w-[420px] flex-shrink-0 border-r border-[#1e2d4d] flex flex-col pb-20 lg:pb-0 ${mobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-5 py-3 border-b border-[#1e2d4d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Messages</h2>
              {totalUnread > 0 && (
                <span className="bg-teal-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                realtimeStatus === 'live'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : realtimeStatus === 'error'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  realtimeStatus === 'live' ? 'bg-emerald-400 animate-pulse' : realtimeStatus === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                }`} />
                {realtimeStatus === 'live' ? 'Live' : realtimeStatus === 'error' ? 'Offline' : 'Connecting'}
              </span>
            </div>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-colors ${
                bulkMode ? 'bg-teal-500 text-white border-teal-500' : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:text-slate-300'
              }`}
            >
              <i className="ri-stack-line mr-1"></i>
              {bulkMode ? 'Done' : 'Bulk'}
            </button>
          </div>

          {loadError ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyStates type="error" onRetry={() => loadConversations()} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyStates type="no-messages" />
            </div>
          ) : (
            <>
              <BulkActionBar
                selectedCount={selectedConvIds.size}
                totalCount={filteredConversations.length}
                allSelected={selectedConvIds.size === filteredConversations.length && filteredConversations.length > 0}
                onSelectAll={selectAllConvs}
                onClearSelection={clearConvSelection}
                actions={[
                  { key: 'mark_read', label: 'Mark Read', icon: 'ri-check-double-line', variant: 'primary' },
                  { key: 'mark_unread', label: 'Mark Unread', icon: 'ri-mail-unread-line', variant: 'secondary' },
                  { key: 'archive', label: 'Archive', icon: 'ri-archive-line', variant: 'secondary' },
                  { key: 'delete', label: 'Delete', icon: 'ri-delete-bin-line', variant: 'danger', requiresConfirmation: true, confirmationTitle: 'Delete Selected Conversations', confirmationMessage: 'This will permanently delete all messages in the selected conversations. This action cannot be undone.', confirmButtonText: 'Delete', confirmButtonIcon: 'ri-delete-bin-line' },
                ]}
                onAction={handleMessageBulkAction}
                processing={bulkProcessing}
                processingAction={bulkAction}
              />
              <ConversationList
                conversations={filteredConversations}
                activeId={activeConversationId}
                filter={filter}
                searchQuery={searchQuery}
                totalUnread={totalUnread}
                onFilterChange={setFilter}
                onSearchChange={setSearchQuery}
                onSelect={handleSelectConversation}
                sortBy={sortBy}
                onSortChange={setSortBy}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(v => !v)}
                onClearFilters={handleClearFilters}
                onFilterChangeAdvanced={handleFilterChange}
                sortOptions={MESSAGE_SORT_OPTIONS}
                filterConfigs={MESSAGE_FILTER_CONFIGS}
                selectable={bulkMode}
                selectedIds={selectedConvIds}
                onToggleSelect={toggleConvSelection}
                hasMore={convHasMore}
                loadingMore={convLoadingMore}
                onLoadMore={() => loadConversations()}
              />
            </>
          )}
        </div>

        <div className={`flex-1 flex flex-col pb-20 lg:pb-0 ${mobileChatOpen ? 'flex' : 'hidden lg:flex'}`}>
          {activeConversation ? (
            <ChatPanel
              conversation={activeConversation}
              messages={activeMessages}
              job={activeJob}
              guard={activeGuard}
              clientUserId={clientUserId}
              sending={sending || !!messageError || loadError}
              key={messageContextKey}
              onSend={handleSend}
              onBack={handleBackToList}
              messagesEndRef={messagesEndRef}
              hasOlderMessages={msgHasMore}
              loadingOlder={msgLoadingOlder}
              onLoadOlder={handleLoadOlderMessages}
              isArchived={archivedConvIds.has(activeConversation.id)}
              onArchive={() => {
                const newArchived = new Set(archivedConvIds);
                newArchived.add(activeConversation.id);
                saveArchived(newArchived, 'Conversation archived');
              }}
              onUnarchive={() => handleUnarchive(activeConversation.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyStates type="select" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
