"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientDocument, loadClientDocuments } from '@/lib/client-documents';
export interface ClientDocumentsState { status: 'loading' | 'error' | 'ready'; documents: ClientDocument[]; }
export function useClientDocuments(clientId: string | null) {
  const [snapshot,setSnapshot] = useState<{ clientId: string | null; state: ClientDocumentsState }>({ clientId, state: { status: 'loading', documents: [] } });
  const mounted = useRef(false), generation = useRef(0), scope = useRef(clientId), user = useRef<string | null>(null);
  scope.current = clientId;
  const retire = useCallback(() => { generation.current++; },[]);
  const refresh = useCallback(async () => {
    if (!clientId || !mounted.current) return;
    const token = ++generation.current;
    const current = () => mounted.current && generation.current === token && scope.current === clientId;
    setSnapshot({ clientId, state: { status: 'loading', documents: [] } });
    try {
      const documents = await loadClientDocuments(supabase,clientId,current,id => { if (current()) user.current = id; });
      if (current()) setSnapshot({ clientId, state: { status: 'ready', documents } });
    } catch { if (current()) setSnapshot({ clientId, state: { status: 'error', documents: [] } }); }
  },[clientId]);
  useEffect(() => {
    mounted.current = true; void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user?.id !== user.current)) {
        generation.current++; user.current = session?.user?.id || null;
        setSnapshot({ clientId, state: { status: 'loading', documents: [] } });
        clearTimeout(timer); timer = setTimeout(() => { if (mounted.current) void refresh(); },0);
      }
    });
    return () => { mounted.current = false; retire(); subscription.unsubscribe(); clearTimeout(timer); };
  },[refresh,clientId,retire]);
  const saved = useCallback((document: ClientDocument) => {
    if (!mounted.current || scope.current !== clientId || document.client_id !== clientId) return;
    setSnapshot(old => old.clientId !== clientId ? old : { clientId, state: { status: 'ready', documents: old.state.documents.some(d => d.id === document.id) ? old.state.documents.map(d => d.id === document.id ? document : d) : [document,...old.state.documents] } });
  },[clientId]);
  const deleted = useCallback((id: string) => {
    if (!mounted.current || scope.current !== clientId) return;
    setSnapshot(old => old.clientId !== clientId ? old : { clientId, state: { status: 'ready', documents: old.state.documents.filter(d => d.id !== id) } });
  },[clientId]);
  return { state: snapshot.clientId === clientId ? snapshot.state : { status: 'loading' as const, documents: [] }, refresh, saved, deleted };
}
