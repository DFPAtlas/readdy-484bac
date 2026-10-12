export const ANALYTICS_ID = 'G-GYTYP412SF';
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
type Preferences = { necessary: boolean; analytics: boolean; marketing: boolean; functional: boolean };
type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

export function readCookiePreferences(): Preferences | null {
  try {
    const value = JSON.parse(localStorage.getItem('cookieConsent') || 'null');
    const age = Date.now() - Date.parse(value?.timestamp);
    if (value?.version !== 2 || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS ||
        value.necessary !== true || ['analytics', 'marketing', 'functional'].some(key => typeof value[key] !== 'boolean')) return null;
    return value;
  } catch { return null; }
}

export function applyAnalyticsConsent(accepted: boolean): void {
  const win = window as AnalyticsWindow;
  (window as unknown as Record<string, unknown>)[`ga-disable-${ANALYTICS_ID}`] = !accepted;
  if (!accepted) {
    win.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    win.dataLayer = [];
    document.getElementById('quickguard-analytics')?.remove();
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name) && !/^_gid$|^_gat/.test(name)) continue;
      const parts = location.hostname.split('.');
      document.cookie = `${name}=; Max-Age=0; path=/`;
      for (let i = 0; i < parts.length - 1; i++) {
        const domain = parts.slice(i).join('.');
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
      }
    }
    return;
  }
  win.dataLayer ??= [];
  win.gtag ??= (...args: unknown[]) => { win.dataLayer!.push(args); };
  win.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  if (document.getElementById('quickguard-analytics')) return;
  win.gtag('js', new Date());
  win.gtag('config', ANALYTICS_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.id = 'quickguard-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`;
  document.head.appendChild(script);
}
