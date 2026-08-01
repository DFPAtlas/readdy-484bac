'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getMaintenanceMode, getScheduledMaintenance, isMaintenanceActive } from '@/lib/maintenance';

function MaintenanceOverlay() {
  const [message, setMessage] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [countdown, setCountdown] = useState('');
  const [hasSchedule, setHasSchedule] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['maintenance_message', 'maintenance_scheduled_start', 'maintenance_scheduled_end']);

      const find = (k: string) => (data || []).find((d: any) => d.key === k)?.value || '';
      const s = find('maintenance_scheduled_start');
      const e = find('maintenance_scheduled_end');
      const m = find('maintenance_message');

      setMessage(m);
      setStart(s);
      setEnd(e);
      setHasSchedule(!!s && !!e);
    }
    load();
  }, []);

  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setCountdown(`~${days} day${days !== 1 ? 's' : ''}`);
      } else if (hours > 0) {
        setCountdown(`~${hours}h ${minutes}m`);
      } else {
        setCountdown(`~${minutes} min`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const displayMessage = message
    || 'QuickGuard is temporarily unavailable while we perform routine maintenance. We will be back shortly.';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B1933] flex items-center justify-center px-6">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-8 text-center border border-[#1e2d4d]">
        <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-amber-500/25">
          <div className="w-8 h-8 flex items-center justify-center">
            <i className="ri-tools-line text-2xl text-amber-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Scheduled Maintenance</h2>
        <p className="text-slate-400 mb-5">
          {displayMessage}
        </p>

        {hasSchedule && (
          <div className="bg-[#0B1933] border border-[#243656] rounded-lg px-4 py-3 mb-5 inline-block">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Maintenance Window</p>
            <p className="text-sm text-slate-200 font-medium">
              {fmtDate(start)} – {fmtDate(end)}
            </p>
            {countdown && (
              <p className="text-xs text-amber-400/80 mt-1.5 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Estimated remaining: {countdown}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-slate-500">
          If this persists, contact{' '}
          <a href="mailto:support@quickguard.uk" className="text-teal-400 hover:underline">
            support@quickguard.uk
          </a>
        </p>
      </div>
    </div>
  );
}

export default function MaintenanceWrapper({ children }: { children: React.ReactNode }) {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return;
    let cancelled = false;

    async function checkMaintenance() {
      try {
        const maintenance = await getMaintenanceMode();
        let active = maintenance;

        if (!active) {
          const scheduled = await getScheduledMaintenance();
          if (scheduled && isMaintenanceActive(scheduled)) {
            active = true;
          }
        }

        if (!cancelled) setIsMaintenance(active);
      } catch {
        if (!cancelled) setIsMaintenance(false);
      }
    }

    checkMaintenance();

    const interval = setInterval(() => {
      checkMaintenance();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  return (
    <>
      {children}
      {isMaintenance && <MaintenanceOverlay />}
    </>
  );
}