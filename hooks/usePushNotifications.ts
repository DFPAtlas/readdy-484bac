import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const SW_CODE = `
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'QuickGuard', body: e.data.text() }; }
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/quickguard_logo_192x192.png',
    badge: data.badge || '/quickguard_logo_192x192.png',
    tag: data.tag || 'quickguard-default',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
  };
  e.waitUntil(self.registration.showNotification(data.title || 'QuickGuard', options));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if (c.url === url && 'focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
`;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushState {
  supported: boolean;
  permission: NotificationPermission | null;
  subscribed: boolean;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications(role: 'guard' | 'client') {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: null,
    subscribed: false,
    loading: false,
    error: null,
  });
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setState((s) => ({ ...s, supported, permission: supported ? Notification.permission : null }));
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!swRef.current) return;
    const sub = await swRef.current.pushManager.getSubscription();
    if (sub) {
      setState((s) => ({ ...s, subscribed: true, permission: 'granted' }));
    }
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const blob = new Blob([SW_CODE], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      const registration = await navigator.serviceWorker.register(swUrl);
      swRef.current = registration;
      await checkSubscription();
    } catch {
      // silent fail
    }
  }, [checkSubscription]);

  useEffect(() => {
    if (state.supported && state.permission === 'granted') {
      registerServiceWorker();
    }
  }, [state.supported, state.permission, registerServiceWorker]);

  const subscribe = useCallback(async () => {
    if (!state.supported) {
      setState((s) => ({ ...s, error: 'Push notifications not supported on this device' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      setState((s) => ({ ...s, permission }));

      if (permission !== 'granted') {
        setState((s) => ({ ...s, loading: false, error: 'Permission denied' }));
        return;
      }

      await registerServiceWorker();

      if (!swRef.current) {
        setState((s) => ({ ...s, loading: false, error: 'Service worker not ready' }));
        return;
      }

      const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-public-key');
      if (vapidError || !vapidData?.publicKey) {
        setState((s) => ({ ...s, loading: false, error: 'Could not get push config' }));
        return;
      }

      const existingSub = await swRef.current.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const subscription = await swRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const subJson = subscription.toJSON();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setState((s) => ({ ...s, loading: false, error: 'Not logged in' }));
        return;
      }

      const { error: upsertError } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        role,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys?.p256dh!,
        auth: subJson.keys?.auth!,
      }, { onConflict: 'user_id,endpoint' });

      if (upsertError) {
        setState((s) => ({ ...s, loading: false, error: 'Failed to save subscription' }));
        return;
      }

      setState((s) => ({ ...s, subscribed: true, loading: false }));
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message || 'Failed to subscribe' }));
    }
  }, [state.supported, role, registerServiceWorker]);

  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('role', role);
      }
      if (swRef.current) {
        const sub = await swRef.current.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false, loading: false, permission: 'default' }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [role]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}