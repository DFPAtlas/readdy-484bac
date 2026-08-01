import { supabase } from './supabase';

export interface ScheduledMaintenance {
  start: string;
  end: string;
  message: string;
}

let cachedMaintenance: { value: boolean; ts: number } | null = null;
const CACHE_TTL_MS = 30000;

export async function getMaintenanceMode(): Promise<boolean> {
  if (cachedMaintenance && Date.now() - cachedMaintenance.ts < CACHE_TTL_MS) {
    return cachedMaintenance.value;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['maintenance_mode', 'emergency_maintenance_mode']);

    const regularMode = (data || []).find((d: any) => d.key === 'maintenance_mode')?.value === 'true';
    const emergencyMode = (data || []).find((d: any) => d.key === 'emergency_maintenance_mode')?.value === 'true';
    const value = regularMode || emergencyMode;
    cachedMaintenance = { value, ts: Date.now() };
    return value;
  } catch {
    return false;
  }
}

export async function setMaintenanceMode(enabled: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('settings')
      .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('key', 'maintenance_mode');
    return !error;
  } catch {
    return false;
  }
}

let cachedScheduled: { value: ScheduledMaintenance | null; ts: number } | null = null;

export async function getScheduledMaintenance(): Promise<ScheduledMaintenance | null> {
  if (cachedScheduled && Date.now() - cachedScheduled.ts < CACHE_TTL_MS) {
    return cachedScheduled.value;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['maintenance_scheduled_start', 'maintenance_scheduled_end', 'maintenance_message']);

    if (!data) return null;

    const start = data.find(d => d.key === 'maintenance_scheduled_start')?.value || '';
    const end = data.find(d => d.key === 'maintenance_scheduled_end')?.value || '';
    const message = data.find(d => d.key === 'maintenance_message')?.value || '';

    if (!start || !end) {
      cachedScheduled = { value: null, ts: Date.now() };
      return null;
    }

    const value = { start, end, message };
    cachedScheduled = { value, ts: Date.now() };
    return value;
  } catch {
    return null;
  }
}

export async function setScheduledMaintenance(schedule: ScheduledMaintenance): Promise<boolean> {
  try {
    const rows = [
      { key: 'maintenance_scheduled_start', value: schedule.start },
      { key: 'maintenance_scheduled_end', value: schedule.end },
      { key: 'maintenance_message', value: schedule.message },
    ];

    for (const row of rows) {
      const { error } = await supabase
        .from('settings')
        .update({ value: row.value, updated_at: new Date().toISOString() })
        .eq('key', row.key);
      if (error) throw error;
    }
    return true;
  } catch {
    return false;
  }
}

export async function clearScheduledMaintenance(): Promise<boolean> {
  return setScheduledMaintenance({ start: '', end: '', message: '' });
}

export function isMaintenanceActive(schedule: ScheduledMaintenance): boolean {
  const now = new Date();
  const start = new Date(schedule.start);
  const end = new Date(schedule.end);
  return now >= start && now <= end;
}

export function getTimeUntil(schedule: ScheduledMaintenance): { label: string; seconds: number } | null {
  const now = new Date();
  const start = new Date(schedule.start);
  const end = new Date(schedule.end);

  if (now > end) return null;

  if (now < start) {
    const diff = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 1000));
    return { label: 'Starts in', seconds: diff };
  }

  const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  return { label: 'Ends in', seconds: diff };
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}