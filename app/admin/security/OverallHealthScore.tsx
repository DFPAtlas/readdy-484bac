'use client';

import { AdminCounts, SuspiciousActivity, PaymentEmailData, BackupComplianceData } from './SecuritySOCClient';

interface HealthCategory {
  name: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: string;
  icon: string;
}

interface Props {
  infrastructure: any;
  edgeFunctions: any[];
  adminCounts: AdminCounts | null;
  suspiciousActivity: SuspiciousActivity | null;
  paymentEmailData: PaymentEmailData | null;
  backupComplianceData: BackupComplianceData | null;
  stats: { loginsToday: number; failedLogins: number; resetsToday: number; uniqueAdmins: number };
}

function getStatusColor(status: string) {
  if (status === 'healthy') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', dot: 'bg-emerald-500' };
  if (status === 'warning') return { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', dot: 'bg-amber-500' };
  return { bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20', dot: 'bg-red-500' };
}

function computeCategories(props: Props): HealthCategory[] {
  const now = new Date().toLocaleTimeString();

  const authScore = (() => {
    if (!props.adminCounts) return { score: 75, status: 'warning' as const };
    let s = 100;
    if (props.stats.failedLogins > 5) s -= 10;
    if (props.stats.failedLogins > 10) s -= 10;
    if (!props.adminCounts.lastAdminLogin) s -= 10;
    return { score: Math.max(30, s), status: s >= 90 ? 'healthy' as const : s >= 70 ? 'warning' as const : 'critical' as const };
  })();

  const dbScore = (() => {
    if (!props.infrastructure?.tables) return { score: 60, status: 'warning' as const };
    const appTables = props.infrastructure.tables.filter((t: any) => t.schema_name === 'app');
    const withRLS = appTables.filter((t: any) => t.rls_enabled).length;
    const pct = appTables.length > 0 ? Math.round((withRLS / appTables.length) * 100) : 100;
    return { score: pct, status: pct >= 90 ? 'healthy' as const : pct >= 70 ? 'warning' as const : 'critical' as const };
  })();

  const storageScore = (() => {
    if (!props.infrastructure?.buckets) return { score: 60, status: 'warning' as const };
    const expectedPublic = ['avatars', 'quickguard-email-assets', 'email-assets', 'public-assets'];
    const publicBuckets = props.infrastructure.buckets.filter((b: any) => b.public);
    const unexpectedPublic = publicBuckets.filter((b: any) => !expectedPublic.includes(b.name));
    if (unexpectedPublic.length === 0) {
      return { score: 100, status: 'healthy' as const };
    }
    if (unexpectedPublic.length <= 2) {
      return { score: 85, status: 'warning' as const };
    }
    return { score: 60, status: 'critical' as const };
  })();

  const apiScore = (() => {
    if (!props.edgeFunctions || props.edgeFunctions.length === 0) return { score: 60, status: 'warning' as const };
    const noJWT = props.edgeFunctions.filter((f: any) => !f.verify_jwt).length;
    const pct = Math.round(((props.edgeFunctions.length - noJWT) / props.edgeFunctions.length) * 100);
    return { score: pct, status: pct >= 90 ? 'healthy' as const : pct >= 70 ? 'warning' as const : 'critical' as const };
  })();

  const paymentsScore = (() => {
    if (!props.paymentEmailData) return { score: 70, status: 'warning' as const };
    let s = 100;
    if (props.paymentEmailData.stripe.failedEvents24h > 0) s -= 15;
    if (props.paymentEmailData.stripe.pendingPayouts > 5) s -= 10;
    return { score: Math.max(30, s), status: s >= 90 ? 'healthy' as const : s >= 70 ? 'warning' as const : 'critical' as const };
  })();

  const infraScore = (() => {
    const scores = [dbScore.score, storageScore.score, apiScore.score];
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { score: avg, status: avg >= 85 ? 'healthy' as const : avg >= 65 ? 'warning' as const : 'critical' as const };
  })();

  const complianceScore = (() => {
    if (!props.backupComplianceData?.compliance || props.backupComplianceData.compliance.length === 0) return { score: 40, status: 'warning' as const };
    const total = props.backupComplianceData.compliance.length;
    const complete = props.backupComplianceData.compliance.filter(c => c.status === 'complete').length;
    const pct = Math.round((complete / total) * 100);
    return { score: pct, status: pct >= 80 ? 'healthy' as const : pct >= 50 ? 'warning' as const : 'critical' as const };
  })();

  const backupsScore = (() => {
    if (!props.backupComplianceData?.backups || props.backupComplianceData.backups.length === 0) return { score: 40, status: 'warning' as const };
    const healthy = props.backupComplianceData.backups.filter(b => b.status === 'healthy').length;
    const total = props.backupComplianceData.backups.length;
    const pct = Math.round((healthy / total) * 100);
    return { score: pct, status: pct >= 80 ? 'healthy' as const : pct >= 50 ? 'warning' as const : 'critical' as const };
  })();

  const monitoringScore = (() => {
    if (!props.suspiciousActivity) return { score: 60, status: 'warning' as const };
    let s = 100;
    if (props.suspiciousActivity.failedLogins24h > 20) s -= 15;
    if (props.suspiciousActivity.rateLimitHits > 10) s -= 10;
    return { score: Math.max(30, s), status: s >= 90 ? 'healthy' as const : s >= 70 ? 'warning' as const : 'critical' as const };
  })();

  return [
    { name: 'Authentication', ...authScore, lastChecked: now, icon: 'ri-shield-keyhole-line' },
    { name: 'Database', ...dbScore, lastChecked: now, icon: 'ri-database-2-line' },
    { name: 'Storage', ...storageScore, lastChecked: now, icon: 'ri-hard-drive-2-line' },
    { name: 'API Security', ...apiScore, lastChecked: now, icon: 'ri-terminal-box-line' },
    { name: 'Payments', ...paymentsScore, lastChecked: now, icon: 'ri-bank-card-line' },
    { name: 'Infrastructure', ...infraScore, lastChecked: now, icon: 'ri-server-line' },
    { name: 'Compliance', ...complianceScore, lastChecked: now, icon: 'ri-scales-3-line' },
    { name: 'Backups', ...backupsScore, lastChecked: now, icon: 'ri-archive-line' },
    { name: 'Monitoring', ...monitoringScore, lastChecked: now, icon: 'ri-radar-line' },
  ];
}

export default function OverallHealthScore(props: Props) {
  const categories = computeCategories(props);
  const overallScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  const getScoreColor = () => {
    if (overallScore >= 90) return 'text-emerald-400';
    if (overallScore >= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreRing = () => {
    if (overallScore >= 90) return 'border-emerald-500/40';
    if (overallScore >= 70) return 'border-amber-500/40';
    return 'border-red-500/40';
  };

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 flex flex-col items-center justify-center">
          <div className={`w-28 h-28 rounded-full border-4 ${getScoreRing()} flex items-center justify-center mb-3`}>
            <span className={`text-3xl font-bold ${getScoreColor()}`}>{overallScore}%</span>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <i key={star} className={`ri-star-fill text-sm ${star <= Math.round(overallScore / 20) ? 'text-amber-400' : 'text-slate-600'}`}></i>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Overall Security Score</p>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const colors = getStatusColor(cat.status);
            return (
              <div key={cat.name} className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3 hover:border-teal-500/20 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 flex items-center justify-center rounded ${colors.bg}`}>
                      <i className={`${cat.icon} text-xs ${colors.text}`}></i>
                    </div>
                    <span className="text-xs font-medium text-slate-300">{cat.name}</span>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                </div>
                <div className="flex items-end justify-between">
                  <span className={`text-lg font-bold ${colors.text}`}>{cat.score}%</span>
                  <span className="text-[10px] text-slate-600">{cat.lastChecked}</span>
                </div>
                <div className="mt-1.5 w-full bg-[#1a2b4a] rounded-full h-1">
                  <div className={`h-1 rounded-full ${cat.status === 'healthy' ? 'bg-emerald-500' : cat.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${cat.score}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}