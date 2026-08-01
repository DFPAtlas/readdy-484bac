'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import OverallHealthScore from './OverallHealthScore';
import AuthAdminPanel from './AuthAdminPanel';
import ThreatSessionsPanel from './ThreatSessionsPanel';
import InfrastructureSecurityPanel from './InfrastructureSecurityPanel';
import PaymentEmailSecurityPanel from './PaymentEmailSecurityPanel';
import BackupCompliancePanel from './BackupCompliancePanel';
import SecurityTimeline from './SecurityTimeline';
import EmergencyControls from './EmergencyControls';
import SecurityToolsPanel from './SecurityToolsPanel';
import GenerateReport from './GenerateReport';
import SecurityStatsBar from './SecurityStatsBar';
import SecurityAlerts from './SecurityAlerts';
import LoginActivityTable from './LoginActivityTable';
import PasswordResetTable from './PasswordResetTable';

export interface ActivityEntry {
  id: string;
  admin_username: string;
  admin_name: string;
  action_type: string;
  action_description: string;
  ip_address: string;
  metadata: any;
  created_at: string;
  user_agent: string;
}

interface EdgeFunctionInfo {
  name: string;
  slug: string;
  version: number;
  status: string;
  verify_jwt: boolean;
  created_at: string;
  updated_at: string;
  api_verify_jwt?: any;
  source?: string;
}

export interface AdminCounts {
  superAdmins: number;
  totalAdmins: number;
  inactiveAdmins: number;
  lockedAccounts: number;
  permissionChanges7d: number;
  lastAdminLogin: string | null;
}

export interface SuspiciousActivity {
  failedLogins24h: number;
  blockedIPs: number;
  rateLimitHits: number;
  multiCountryLogins: number;
  apiAbuse: number;
  passwordResetSpikes: number;
}

export interface SessionInfo {
  id: string;
  admin: string;
  role: string;
  lastActivity: string;
  status: 'active' | 'idle';
}

export interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  admin: string;
  time: string;
  ip?: string;
  severity?: string;
}

export interface ApiSecretStatus {
  service: string;
  configured: boolean;
  status: 'healthy' | 'warning' | 'critical';
  last_checked: string;
}

export interface PaymentEmailData {
  stripe: {
    webhookStatus: string;
    webhookVerification: string;
    failedEvents24h: number;
    pendingEvents: number;
    pendingPayouts: number;
    openDisputes: number;
    refunds: number;
    webhookLatency: string;
    latestWebhook: string | null;
    signingSecret: string;
  };
  email: {
    smtpConnected: boolean;
    queuePending: number;
    failedEmails24h: number;
    sentToday: number;
    bounceRate: string;
    spfValid: boolean;
    dkimValid: boolean;
    dmarcValid: boolean;
    dailySendCount: number;
  };
}

export interface BackupComplianceData {
  backups: {
    backup_type: string;
    status: string;
    last_backup_at: string | null;
    last_restore_test_at: string | null;
    retention_days: number;
    notes: string | null;
  }[];
  compliance: {
    key: string;
    label: string;
    status: string;
    notes: string | null;
  }[];
}

interface FetchState {
  security: 'idle' | 'loading' | 'error';
  infrastructure: 'idle' | 'loading' | 'error';
  edgeFunctions: 'idle' | 'loading' | 'error';
  emergencySettings: 'idle' | 'loading' | 'error';
  apiSecrets: 'idle' | 'loading' | 'error';
  paymentEmail: 'idle' | 'loading' | 'error';
  backupCompliance: 'idle' | 'loading' | 'error';
}

export default function SecuritySOCClient() {
  const [loginEvents, setLoginEvents] = useState<ActivityEntry[]>([]);
  const [resetEvents, setResetEvents] = useState<ActivityEntry[]>([]);
  const [infrastructure, setInfrastructure] = useState<any>(null);
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunctionInfo[]>([]);
  const [edgeFunctionsError, setEdgeFunctionsError] = useState<string | null>(null);
  const [emergencySettings, setEmergencySettings] = useState<Record<string, string>>();
  const [apiSecrets, setApiSecrets] = useState<ApiSecretStatus[]>([]);
  const [paymentEmailData, setPaymentEmailData] = useState<PaymentEmailData | null>(null);
  const [backupComplianceData, setBackupComplianceData] = useState<BackupComplianceData | null>(null);
  const [adminCounts, setAdminCounts] = useState<AdminCounts | null>(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [stats, setStats] = useState({
    loginsToday: 0,
    failedLogins: 0,
    resetsToday: 0,
    uniqueAdmins: 0,
  });
  const [fetchState, setFetchState] = useState<FetchState>({
    security: 'idle',
    infrastructure: 'idle',
    edgeFunctions: 'idle',
    emergencySettings: 'idle',
    apiSecrets: 'idle',
    paymentEmail: 'idle',
    backupCompliance: 'idle',
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const invokeFunction = useCallback(async (action: string, body?: any, retries = 1): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('security-dashboard', {
          body: { action, ...body },
        });
        if (error) throw error;
        return data;
      } catch (err: any) {
        if (attempt === retries) {
          console.error(`[SecuritySOC] ${action} failed:`, err.message || err);
          throw err;
        }
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }, []);

  const fetchSecurityData = useCallback(async () => {
    setFetchState(s => ({ ...s, security: 'loading' }));
    try {
      const data = await invokeFunction('security_data', undefined, 1);
      setLoginEvents(data.loginEvents || []);
      setResetEvents(data.resetEvents || []);
      setStats(data.stats || { loginsToday: 0, failedLogins: 0, resetsToday: 0, uniqueAdmins: 0 });
      setAdminCounts(data.adminCounts || null);
      setSuspiciousActivity(data.suspiciousActivity || null);
      setTimelineEvents(data.timeline || []);
      setActiveSessions(data.activeSessions || []);
      setLastRefresh(new Date());
      setFetchState(s => ({ ...s, security: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, security: 'error' }));
    }
  }, [invokeFunction]);

  const fetchInfrastructure = useCallback(async () => {
    setFetchState(s => ({ ...s, infrastructure: 'loading' }));
    try {
      const data = await invokeFunction('infrastructure_audit', undefined, 1);
      setInfrastructure(data || null);
      setFetchState(s => ({ ...s, infrastructure: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, infrastructure: 'error' }));
    }
  }, [invokeFunction]);

  const fetchEdgeFunctions = useCallback(async () => {
    setFetchState(s => ({ ...s, edgeFunctions: 'loading' }));
    try {
      const data = await invokeFunction('edge_functions_audit', undefined, 1);
      if (data?.error) {
        setEdgeFunctionsError(data.error);
        setEdgeFunctions([]);
      } else {
        setEdgeFunctions(data?.functions || []);
        setEdgeFunctionsError(null);
      }
      setFetchState(s => ({ ...s, edgeFunctions: 'idle' }));
    } catch {
      setEdgeFunctionsError('Edge function unavailable');
      setFetchState(s => ({ ...s, edgeFunctions: 'error' }));
    }
  }, [invokeFunction]);

  const fetchEmergencySettings = useCallback(async () => {
    setFetchState(s => ({ ...s, emergencySettings: 'loading' }));
    try {
      const data = await invokeFunction('get_emergency_settings', undefined, 1);
      setEmergencySettings(data?.settings || {});
      setFetchState(s => ({ ...s, emergencySettings: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, emergencySettings: 'error' }));
    }
  }, [invokeFunction]);

  const fetchApiSecrets = useCallback(async () => {
    setFetchState(s => ({ ...s, apiSecrets: 'loading' }));
    try {
      const data = await invokeFunction('api_secret_status', undefined, 1);
      setApiSecrets(data?.secrets || []);
      setFetchState(s => ({ ...s, apiSecrets: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, apiSecrets: 'error' }));
    }
  }, [invokeFunction]);

  const fetchPaymentEmail = useCallback(async () => {
    setFetchState(s => ({ ...s, paymentEmail: 'loading' }));
    try {
      const data = await invokeFunction('payment_email_status', undefined, 1);
      setPaymentEmailData(data || null);
      setFetchState(s => ({ ...s, paymentEmail: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, paymentEmail: 'error' }));
    }
  }, [invokeFunction]);

  const fetchBackupCompliance = useCallback(async () => {
    setFetchState(s => ({ ...s, backupCompliance: 'loading' }));
    try {
      const data = await invokeFunction('backup_compliance_status', undefined, 1);
      setBackupComplianceData(data || null);
      setFetchState(s => ({ ...s, backupCompliance: 'idle' }));
    } catch {
      setFetchState(s => ({ ...s, backupCompliance: 'error' }));
    }
  }, [invokeFunction]);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchSecurityData(),
      fetchInfrastructure(),
      fetchEdgeFunctions(),
      fetchEmergencySettings(),
      fetchApiSecrets(),
      fetchPaymentEmail(),
      fetchBackupCompliance(),
    ]);
  }, [fetchSecurityData, fetchInfrastructure, fetchEdgeFunctions, fetchEmergencySettings, fetchApiSecrets, fetchPaymentEmail, fetchBackupCompliance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSecurityData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSecurityData]);

  useEffect(() => {
    const channel = supabase
      .channel('security-soc')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'admin_activity_log' },
        () => fetchSecurityData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSecurityData]);

  const hasAnyError = Object.values(fetchState).some(s => s === 'error');
  const isFullyLoaded = Object.values(fetchState).every(s => s === 'idle');

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0B1933] pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Operations Centre</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time visibility into the health and security of the entire QuickGuard platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasAnyError && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
              <i className="ri-error-warning-fill"></i>
              Some data sources unavailable
            </span>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-teal-500 animate-pulse' : 'bg-slate-500'}`}></span>
            <span suppressHydrationWarning>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer whitespace-nowrap ${
              autoRefresh
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20'
                : 'bg-[#1a2b4a] border-[#1a2b4a] text-slate-400 hover:bg-[#1e2d4d] hover:text-white'
            }`}
          >
            <i className={`${autoRefresh ? 'ri-pause-line' : 'ri-play-line'} mr-1`}></i>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1a2b4a] bg-[#111d35] text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line mr-1"></i>
            Refresh
          </button>
        </div>
      </div>

      <OverallHealthScore
        infrastructure={infrastructure}
        edgeFunctions={edgeFunctions}
        adminCounts={adminCounts}
        suspiciousActivity={suspiciousActivity}
        paymentEmailData={paymentEmailData}
        backupComplianceData={backupComplianceData}
        stats={stats}
      />

      <SecurityStatsBar stats={stats} />
      <SecurityAlerts loginEvents={loginEvents} resetEvents={resetEvents} />

      <AuthAdminPanel adminCounts={adminCounts} />

      <ThreatSessionsPanel
        suspiciousActivity={suspiciousActivity}
        activeSessions={activeSessions}
        onSessionChange={fetchSecurityData}
      />

      <InfrastructureSecurityPanel
        infrastructure={infrastructure}
        edgeFunctions={edgeFunctions}
        edgeFunctionsError={edgeFunctionsError}
        apiSecrets={apiSecrets}
      />

      <PaymentEmailSecurityPanel paymentEmailData={paymentEmailData} />

      <BackupCompliancePanel backupComplianceData={backupComplianceData} />

      <SecurityTimeline timelineEvents={timelineEvents} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LoginActivityTable events={loginEvents} />
        <PasswordResetTable events={resetEvents} />
      </div>

      <EmergencyControls settings={emergencySettings} onSettingChange={fetchEmergencySettings} />

      <SecurityToolsPanel
        infrastructure={infrastructure}
        adminCounts={adminCounts}
        suspiciousActivity={suspiciousActivity}
      />

      <GenerateReport
        stats={stats}
        loginEvents={loginEvents}
        resetEvents={resetEvents}
        infrastructure={infrastructure}
        edgeFunctions={edgeFunctions}
        emergencySettings={emergencySettings || {}}
      />
    </div>
  );
}