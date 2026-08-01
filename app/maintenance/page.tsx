'use client';

import { useEffect, useState } from 'react';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface MaintenanceInfo {
  mode: boolean;
  start: string;
  end: string;
  message: string;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

function getCountdown(end: string): string {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return '';

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `~${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `~${hours}h ${minutes}m`;
  }
  return `~${minutes} min`;
}

export default function MaintenancePage() {
  const router = useSafeRouter();
  const [info, setInfo] = useState<MaintenanceInfo>({ mode: true, start: '', end: '', message: '' });
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    async function loadInfo() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['maintenance_mode', 'maintenance_message', 'maintenance_scheduled_start', 'maintenance_scheduled_end']);

      if (!data) return;

      const find = (k: string) => (data || []).find((d: any) => d.key === k)?.value || '';

      setInfo({
        mode: find('maintenance_mode') === 'true',
        start: find('maintenance_scheduled_start'),
        end: find('maintenance_scheduled_end'),
        message: find('maintenance_message'),
      });
    }

    loadInfo();
  }, []);

  useEffect(() => {
    if (!info.end) return;
    const tick = () => setCountdown(getCountdown(info.end));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [info.end]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (data?.value !== 'true') {
        router.push('/');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const hasSchedule = info.start && info.end;
  const defaultMessage = "QuickGuard is currently undergoing scheduled maintenance. We're making things better and will be back online shortly.";
  const displayMessage = info.message || defaultMessage;

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col items-center justify-center px-6">
      <div className="absolute top-6 left-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
          <div className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-lg"></i>
          </div>
          Back to Home
        </Link>
      </div>
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <div className="w-10 h-10 flex items-center justify-center">
            <i className="ri-tools-line text-3xl text-teal-400" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          We'll be back soon
        </h1>
        <p className="text-lg text-slate-400 mb-8 leading-relaxed">
          {displayMessage}
        </p>

        {hasSchedule && (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl px-5 py-4 mb-6 inline-block text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-calendar-schedule-line text-amber-400 text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Maintenance Window
                </p>
                <p className="text-sm text-slate-200 font-medium">
                  {formatRange(info.start, info.end)}
                </p>
                {countdown && (
                  <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Estimated remaining: {countdown}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="inline-flex items-center space-x-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-5 py-2.5 rounded-full mb-10">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-medium text-sm">Maintenance in progress</span>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <p className="text-sm text-slate-500 mb-3">Need urgent assistance?</p>
          <a
            href="mailto:info@quickguard.uk"
            className="inline-flex items-center space-x-2 text-teal-400 hover:text-teal-300 font-medium transition-colors text-sm"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-mail-line" />
            </div>
            <span>info@quickguard.uk</span>
          </a>
        </div>
      </div>
    </div>
  );
}