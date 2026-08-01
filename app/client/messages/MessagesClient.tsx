'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import ConversationList from './ConversationList';
import ChatPanel from './ChatPanel';
import EmptyStates from './EmptyStates';
import BulkActionBar from '../components/BulkActionBar';
import { canSendJobMessage } from '@/lib/message-permissions';

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

const CONV_PAGE_SIZE = 30;
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
  const router = useRouter();
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

  // Resolve partner profile from guards, admin_users or users tables
  const resolvePartner = useCallback(async (
    userIds: string[],
    senderTypes: Record<string, string>
  ): Promise<Record<string, PartnerProfile>> => {
    const result: Record<string, PartnerProfile> = {};
    if (userIds.length === 0) return result;

    const [guardRes, adminRes] = await Promise.all([
      supabase.from('guards').select('user_id, full_name, profile_image_url, rating').in('user_id', userIds),
      supabase.from('admin_users').select('user_id, full_name').in('user_id', userIds),
    ]);

    const guardMap: Record<string, { full_name: string; profile_image_url: string | null; rating: number | null }> = {};
    (guardRes.data || []).forEach(g => { if (g.user_id) guardMap[g.user_id] = g; });

    const adminMap: Record<string, { full_name: string }> = {};
    (adminRes.data || []).forEach(a => { if (a.user_id) adminMap[a.user_id] = a; });

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
  }, []);

  const buildConversations = useCallback(async (
    messages: Message[],
    userId: string,
    existingConvs: Conversation[]
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
        ? supabase.from('jobs').select('id, job_title, venue_city, status, start_date, start_time').in('id', jobIds)
        : Promise.resolve({ data: [] as JobInfo[] }),
    ]);

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

  const loadConversations = useCallback(async (append = false) => {
    setLoadError(false);
    if (append) setConvLoadingMore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }
      if (!mountedRef.current) return;
      setClientUserId(user.id);

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }
      if (!mountedRef.current) return;

      setCompanyName(client.company_name || 'Client');
      setSubscriptionTier(client.subscription_tier || 'Basic');
      setInitials(getInitials(client.company_name || 'Client'));

      const savedArchived = localStorage.getItem(`quickguard_archived_client_${user.id}`);
      if (savedArchived) {
        try {
          setArchivedConvIds(new Set(JSON.parse(savedArchived)));
        } catch {}
      }

      const offset = append ? convNextOffsetRef.current : 0;
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + CONV_PAGE_SIZE * 5 - 1);

      if (!mountedRef.current) return;

      if (!messages || messages.length === 0) {
        setLoading(false);
        if (!append) setConversations([]);
        return;
      }

      const convs = await buildConversations(messages as Message[], user.id, []);

      if (!mountedRef.current) return;

      if (append) {
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newOnes = convs.filter(c => !existingIds.has(c.id));
          return [...prev, ...newOnes];
        });
      } else {
        setConversations(convs);
      }
      setConvHasMore(messages.length >= CONV_PAGE_SIZE * 5);
      if (messages.length > 0) convNextOffsetRef.current = offset + CONV_PAGE_SIZE * 5;
      setTotalUnread(convs.reduce((sum, c) => sum + c.unread_count, 0));
      setLoading(false);
    } catch {
      if (mountedRef.current) {
        setLoadError(true);
        setLoading(false);
      }
    } finally {
      if (append && mountedRef.current) setConvLoadingMore(false);
    }
  }, [router, buildConversations]);

  const refreshSingleConversation = useCallback(async (newMsg: Message, userId: string) => {
    if (!mountedRef.current) return;

    const otherId = newMsg.sender_id === userId ? newMsg.receiver_id : newMsg.sender_id;
    const key = newMsg.job_id ? `${newMsg.job_id}_${otherId}` : `${otherId}`;

    const senderTypeByUid: Record<string, string> = { [otherId]: newMsg.sender_type };
    const partnerMap = await resolvePartner([otherId], senderTypeByUid);
    const partner = partnerMap[otherId];

    let jobInfo: JobInfo | null = null;
    if (newMsg.job_id) {
      const { data } = await supabase.from('jobs').select('id, job_title, venue_city, status, start_date, start_time').eq('id', newMsg.job_id).maybeSingle();
      jobInfo = data || null;
    }

    const isSupport = partner?.type === 'admin' || newMsg.sender_type === 'admin' || newMsg.sender_type === 'support';
    const name = partner?.full_name || 'Unknown';

    if (!mountedRef.current) return;

    setConversations(prev => {
      const existing = prev.find(c => c.id === key);
      const updated: Conversation = {
        id: key,
        job_id: newMsg.job_id,
        other_user_id: otherId,
        other_type: partner?.type || 'unknown',
        other_name: name,
        other_avatar: partner?.avatar || null,
        other_initials: getInitials(name),
        other_rating: partner?.rating || null,
        job_title: jobInfo?.job_title || existing?.job_title || null,
        job_city: jobInfo?.venue_city || existing?.job_city || null,
        job_status: jobInfo?.status || existing?.job_status || null,
        last_message: newMsg.message_text,
        last_time: newMsg.created_at,
        unread_count: (existing?.unread_count || 0) + (newMsg.receiver_id === userId && !newMsg.read ? 1 : 0),
        status: 'Open',
        is_support: isSupport,
      };

      const filtered = prev.filter(c => c.id !== key);
      return [updated, ...filtered];
    });

    if (newMsg.receiver_id === userId && !newMsg.read) {
      setTotalUnread(prev => prev + 1);
    }

    if (newMsg.sender_id === userId || (newMsg.receiver_id === userId)) {
      setActiveMessages(prev => {
        if (prev.length === 0) return prev;
        const firstMsg = prev[0];
        const firstOther = firstMsg.sender_id === userId ? firstMsg.receiver_id : firstMsg.sender_id;
        if (firstOther !== otherId) return prev;
        if (newMsg.job_id && firstMsg.job_id !== newMsg.job_id) return prev;
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    }
  }, [resolvePartner]);

  useEffect(() => {
    mountedRef.current = true;
    loadConversations(false);
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!clientUserId) return;

    const channel = supabase
      .channel(`client-messages-app-${clientUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'app',
        table: 'messages',
        filter: `receiver_id=eq.${clientUserId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        refreshSingleConversation(payload.new as Message, clientUserId);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'app',
        table: 'messages',
        filter: `sender_id=eq.${clientUserId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        refreshSingleConversation(payload.new as Message, clientUserId);
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
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
        else setRealtimeStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [clientUserId, refreshSingleConversation]);

  // Auto-scroll to latest message when new message arrives
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    if (activeMessages.length > 0 && !msgLoadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const loadActiveMessages = useCallback(async (beforeCreatedAt?: string) => {
    if (!activeConversation || !clientUserId) return;

    const isLoadMore = !!beforeCreatedAt;
    if (isLoadMore) setMsgLoadingOlder(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${clientUserId},receiver_id.eq.${clientUserId}`)
        .order('created_at', { ascending: false })
        .limit(MSG_PAGE_SIZE);

      if (activeConversation.job_id) {
        query = query.eq('job_id', activeConversation.job_id);
      } else {
        query = query.is('job_id', null);
      }

      if (beforeCreatedAt) {
        query = query.lt('created_at', beforeCreatedAt);
      }

      const { data } = await query;

      const filtered = ((data || []) as Message[]).filter(m => {
        const otherId = m.sender_id === clientUserId ? m.receiver_id : m.sender_id;
        return otherId === activeConversation.other_user_id;
      }).reverse();

      if (!mountedRef.current) return;

      if (isLoadMore) {
        skipScrollRef.current = true;
        setActiveMessages(prev => [...filtered, ...prev]);
      } else {
        setActiveMessages(filtered);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }

      setMsgHasMore(filtered.length >= MSG_PAGE_SIZE);
      if (filtered.length > 0) {
        setMsgOldestCreatedAt(filtered[0].created_at);
      }

      if (!activeConversation.job_id) {
        setActiveJob(null);
      } else if (!isLoadMore) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('id, job_title, venue_city, status, start_date, start_time')
          .eq('id', activeConversation.job_id)
          .maybeSingle();
        if (jobData && mountedRef.current) setActiveJob(jobData);
      }

      if (!isLoadMore) {
        const { data: guardData } = await supabase
          .from('guards')
          .select('id, full_name, profile_image_url, rating')
          .eq('user_id', activeConversation.other_user_id)
          .maybeSingle();
        if (guardData && mountedRef.current) setActiveGuard(guardData);
      }

      if (!isLoadMore) {
        const unreadIds = filtered.filter(m => m.receiver_id === clientUserId && !m.read).map(m => m.id);
        if (unreadIds.length > 0) {
          await supabase.from('messages').update({ read: true }).in('id', unreadIds);
          setConversations(prev => prev.map(c =>
            c.id === activeConversationId ? { ...c, unread_count: 0 } : c
          ));
          setTotalUnread(prev => Math.max(0, prev - unreadIds.length));
        }
      }
    } finally {
      if (isLoadMore && mountedRef.current) setMsgLoadingOlder(false);
    }
  }, [activeConversation, activeConversationId, clientUserId]);

  useEffect(() => {
    if (activeConversationId) {
      setActiveMessages([]);
      setMsgHasMore(false);
      setMsgOldestCreatedAt(null);
      loadActiveMessages();
    }
  }, [activeConversationId]);

  const handleLoadOlderMessages = () => {
    if (msgOldestCreatedAt) loadActiveMessages(msgOldestCreatedAt);
  };

  const handleSend = async (text: string) => {
    if (!activeConversation || !clientUserId || !text.trim()) return;
    setSending(true);
    try {
      if (activeConversation.job_id) {
        const perm = await canSendJobMessage({
          currentUserId: clientUserId,
          currentUserType: 'client',
          jobId: activeConversation.job_id,
          otherUserId: activeConversation.other_user_id,
          otherUserType: activeConversation.other_type === 'guard' ? 'guard' : activeConversation.other_type || 'guard',
        });
        if (!perm.allowed) {
          setToast(perm.error || 'You do not have permission to message this guard for this job.');
          setTimeout(() => setToast(''), 4000);
          setSending(false);
          return;
        }
      }
      const { error } = await supabase.from('messages').insert({
        sender_id: clientUserId,
        sender_type: 'client',
        receiver_id: activeConversation.other_user_id,
        receiver_type: activeConversation.other_type === 'guard' ? 'guard' : activeConversation.other_type || 'guard',
        message_text: text.trim(),
        job_id: activeConversation.job_id,
        read: false,
      });
      if (error) throw error;
      try {
        const jobTitle = activeConversation.job_title;
        await supabase.from('notifications').insert({
          user_id: activeConversation.other_user_id,
          user_type: activeConversation.other_type === 'guard' ? 'guard' : activeConversation.other_type || 'guard',
          type: 'message',
          title: 'New message',
          message: `New message from client${jobTitle ? ` for "${jobTitle}"` : ''}`,
          link: '/guard/messages',
          is_read: false,
        });
      } catch (notifyErr) {
        console.error('Failed to create notification:', notifyErr);
      }
      await loadActiveMessages();
    } catch {
      setToast('Failed to send message. Please check your connection and try again.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSending(false);
    }
  };

  const toggleConvSelection = (convId: string) => {
    setSelectedConvIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const selectAllConvs = () => setSelectedConvIds(new Set(filteredConversations.map(c => c.id)));
  const clearConvSelection = () => setSelectedConvIds(new Set());

  const handleBulkMarkRead = async () => {
    setBulkProcessing(true);
    setBulkAction('mark_read');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectedConvs = Array.from(selectedConvIds)
        .map(id => conversations.find(c => c.id === id))
        .filter(Boolean) as Conversation[];

      const idArrays = await Promise.all(
        selectedConvs.map(async (conv) => {
          let query = supabase
            .from('messages')
            .select('id')
            .eq('receiver_id', user.id)
            .eq('read', false)
            .eq('sender_id', conv.other_user_id);

          if (conv.job_id) {
            query = query.eq('job_id', conv.job_id);
          } else {
            query = query.is('job_id', null);
          }

          const { data } = await query;
          return (data || []).map(m => m.id);
        })
      );

      const unreadIds = idArrays.flat();
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ read: true }).in('id', unreadIds);
      }

      const selectedSet = new Set(selectedConvIds);
      setConversations(prev => prev.map(c =>
        selectedSet.has(c.id) ? { ...c, unread_count: 0 } : c
      ));
      setTotalUnread(prev => {
        const markedCount = selectedConvs.reduce((sum, c) => sum + c.unread_count, 0);
        return Math.max(0, prev - markedCount);
      });
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedConvIds(new Set());
      setBulkMode(false);
      setToast('Marked as read');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleBulkMarkUnread = async () => {
    setBulkProcessing(true);
    setBulkAction('mark_unread');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectedConvs = Array.from(selectedConvIds)
        .map(id => conversations.find(c => c.id === id))
        .filter(Boolean) as Conversation[];

      const idArrays = await Promise.all(
        selectedConvs.map(async (conv) => {
          let query = supabase
            .from('messages')
            .select('id')
            .eq('receiver_id', user.id)
            .eq('sender_id', conv.other_user_id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (conv.job_id) {
            query = query.eq('job_id', conv.job_id);
          } else {
            query = query.is('job_id', null);
          }

          const { data } = await query;
          return (data || []).map(m => m.id);
        })
      );

      const latestIds = idArrays.flat();
      if (latestIds.length > 0) {
        await supabase.from('messages').update({ read: false }).in('id', latestIds);
      }

      setConversations(prev => prev.map(c =>
        selectedConvIds.has(c.id) ? { ...c, unread_count: Math.max(c.unread_count, 1) } : c
      ));
      setTotalUnread(prev => prev + latestIds.length);
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedConvIds(new Set());
      setBulkMode(false);
      setToast('Marked as unread');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleBulkArchive = async () => {
    setBulkProcessing(true);
    setBulkAction('archive');
    try {
      const newArchived = new Set(archivedConvIds);
      selectedConvIds.forEach(id => newArchived.add(id));
      setArchivedConvIds(newArchived);
      localStorage.setItem(`quickguard_archived_client_${clientUserId}`, JSON.stringify([...newArchived]));
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedConvIds(new Set());
      setBulkMode(false);
      setToast('Conversations archived');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleUnarchive = (convId: string) => {
    const newArchived = new Set(archivedConvIds);
    newArchived.delete(convId);
    setArchivedConvIds(newArchived);
    localStorage.setItem(`quickguard_archived_client_${clientUserId}`, JSON.stringify([...newArchived]));
    setToast('Conversation unarchived');
    setTimeout(() => setToast(''), 3000);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    setBulkAction('delete');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectedConvs = Array.from(selectedConvIds)
        .map(id => conversations.find(c => c.id === id))
        .filter(Boolean) as Conversation[];

      const deleteOps = selectedConvs.map(async (conv) => {
        let query = supabase
          .from('messages')
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conv.other_user_id}),and(sender_id.eq.${conv.other_user_id},receiver_id.eq.${user.id})`);

        if (conv.job_id) {
          query = query.eq('job_id', conv.job_id);
        } else {
          query = query.is('job_id', null);
        }

        return query;
      });

      await Promise.all(deleteOps);

      const deletedSet = new Set(selectedConvIds);
      setConversations(prev => prev.filter(c => !deletedSet.has(c.id)));
      if (activeConversationId && deletedSet.has(activeConversationId)) {
        setActiveConversationId(null);
        setActiveMessages([]);
        setMobileChatOpen(false);
      }
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedConvIds(new Set());
      setBulkMode(false);
      setToast('Conversations deleted');
      setTimeout(() => setToast(''), 3000);
    }
  };

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
              <EmptyStates type="error" onRetry={() => loadConversations(false)} />
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
                onLoadMore={() => loadConversations(true)}
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
              sending={sending}
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
                setArchivedConvIds(newArchived);
                localStorage.setItem(`quickguard_archived_client_${clientUserId}`, JSON.stringify([...newArchived]));
                setToast('Conversation archived');
                setTimeout(() => setToast(''), 3000);
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