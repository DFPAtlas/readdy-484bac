'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client, SubscriptionInfo } from '@/lib/client-types';

interface UseClientDataResult {
  client: Client | null;
  subscription: SubscriptionInfo | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  initials: string;
}

function computeInitials(name: string): string {
  if (!name) return 'CL';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function useClientData(): UseClientDataResult {
  const [client, setClient] = useState<Client | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      setUserId(user.id);

      const [clientRes, subRes] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!mountedRef.current) return;

      if (clientRes.error) {
        setError(clientRes.error.message);
        return;
      }

      setClient((clientRes.data || null) as Client | null);
      setSubscription((subRes.data || null) as SubscriptionInfo | null);
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return {
    client,
    subscription,
    userId,
    loading,
    error,
    refetch: fetchData,
    initials: client ? computeInitials(client.company_name) : 'CL',
  };
}

// ---------------------------------------------------------------------------
// useRealtimeChannel - safe realtime subscription hook
// ---------------------------------------------------------------------------

interface RealtimeOptions {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  enabled?: boolean;
  onEvent: () => void;
}

export function useRealtimeChannel({
  channelName,
  table,
  schema = 'public',
  filter,
  event = '*',
  enabled = true,
  onEvent,
}: RealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const config: Record<string, string> = { event, schema, table };
    if (filter) config.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', config as Parameters<typeof channel.on>[1], () => {
        onEvent();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, schema, filter, event, enabled, onEvent]);
}

// ---------------------------------------------------------------------------
// useMultipleRealtimeChannels
// ---------------------------------------------------------------------------

interface MultiChannelOptions {
  enabled?: boolean;
  onAnyEvent: () => void;
  channels: Array<{
    name: string;
    table: string;
    schema?: string;
    filter?: string;
    event?: string;
  }>;
}

export function useMultipleRealtimeChannels({ channels, enabled = true, onAnyEvent }: MultiChannelOptions) {
  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    const subs = channels.map(ch => {
      const config: Record<string, string> = {
        event: ch.event || '*',
        schema: ch.schema || 'public',
        table: ch.table,
      };
      if (ch.filter) config.filter = ch.filter;

      return supabase
        .channel(ch.name)
        .on('postgres_changes', config as Parameters<ReturnType<typeof supabase.channel>['on']>[1], () => {
          onAnyEvent();
        })
        .subscribe();
    });

    return () => {
      subs.forEach(sub => supabase.removeChannel(sub));
    };
  }, [channels, enabled, onAnyEvent]);
}