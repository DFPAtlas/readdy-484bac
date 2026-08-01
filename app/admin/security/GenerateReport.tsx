'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';

interface Props {
  stats: {
    loginsToday: number;
    failedLogins: number;
    resetsToday: number;
    uniqueAdmins: number;
  };
  loginEvents: any[];
  resetEvents: any[];
  infrastructure: any;
  edgeFunctions: any[];
  emergencySettings: Record<string, string>;
}

export default function GenerateReport({ stats, loginEvents, resetEvents, infrastructure, edgeFunctions, emergencySettings }: Props) {
  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const computeScore = () => {
    let score = 100;
    if (stats.failedLogins > 5) score -= 5;
    if (stats.failedLogins > 10) score -= 5;

    if (infrastructure?.tables) {
      const withoutRLS = infrastructure.tables.filter((t: any) => !t.rls_enabled).length;
      score -= withoutRLS * 2;
      const publicTables = infrastructure.tables.filter((t: any) => t.public_access).length;
      score -= publicTables * 3;
    }

    if (infrastructure?.buckets) {
      const publicBuckets = infrastructure.buckets.filter((b: any) => b.public).length;
      score -= publicBuckets * 3;
    }

    if (edgeFunctions) {
      const noJWT = edgeFunctions.filter((f: any) => !f.verify_jwt).length;
      score -= noJWT * 2;
    }

    const activeEmergencies = Object.values(emergencySettings).filter(v => v === 'true').length;
    score -= activeEmergencies * 3;

    return Math.max(0, Math.min(100, score));
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excellent';
    if (s >= 75) return 'Good';
    if (s >= 60) return 'Fair';
    return 'Needs Attention';
  };

  const getScoreColor = (s: number) => {
    if (s >= 90) return '#10b981';
    if (s >= 75) return '#14b8a6';
    if (s >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const handleGenerate = () => {
    setGenerating(true);
    setReportReady(false);
    setReportUrl(null);

    const score = computeScore();
    const scoreLabel = getScoreLabel(score);
    const scoreColor = getScoreColor(score);

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    const addTitle = (text: string) => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(text, margin + 3, y + 7);
      y += 16;
    };

    const addLine = (label: string, value: string, valueColor?: string) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setTextColor(valueColor ? valueColor as any : 226, 232, 240);
      doc.setFont('helvetica', 'bold');
      doc.text(value, margin + 80, y);
      y += 6;
    };

    doc.setFillColor(11, 25, 51);
    doc.rect(0, 0, pageW, 297, 'F');

    doc.setFillColor(17, 29, 53);
    doc.rect(margin, margin, contentW, 50, 'F');
    doc.setDrawColor(26, 43, 74);
    doc.rect(margin, margin, contentW, 50);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('QuickGuard', margin + 5, margin + 14);

    doc.setFontSize(16);
    doc.setTextColor(20, 184, 166);
    doc.text('Security Operations Report', margin + 5, margin + 24);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, margin + 5, margin + 36);
    doc.text('Classification: Confidential — Super Admin Only', margin + 5, margin + 43);

    y = margin + 58;

    doc.setFillColor(17, 29, 53);
    doc.rect(margin, y, contentW, 24, 'F');
    doc.setDrawColor(26, 43, 74);
    doc.rect(margin, y, contentW, 24);

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(scoreColor as any);
    doc.text(`${score}%`, margin + 8, y + 16);

    doc.setFontSize(10);
    doc.setTextColor(226, 232, 240);
    doc.text(`Overall Security Score — ${scoreLabel}`, margin + 40, y + 12);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Based on real-time platform audit across all security categories`, margin + 40, y + 20);

    y += 32;

    addTitle('Authentication Status');
    addLine('Admin Logins Today', String(stats.loginsToday));
    addLine('Failed Admin Logins', String(stats.failedLogins), stats.failedLogins > 5 ? '#ef4444' : '#10b981');
    addLine('Password Resets Today', String(stats.resetsToday));
    addLine('Unique Admins Active', String(stats.uniqueAdmins));
    y += 4;

    addTitle('Database Security');
    if (infrastructure?.tables) {
      const totalTables = infrastructure.tables.filter((t: any) => t.schema_name === 'app').length;
      const rlsEnabled = infrastructure.tables.filter((t: any) => t.schema_name === 'app' && t.rls_enabled).length;
      const publicAccess = infrastructure.tables.filter((t: any) => t.schema_name === 'app' && t.public_access).length;
      addLine('Tables in app schema', String(totalTables));
      addLine('RLS Enabled', `${rlsEnabled}/${totalTables}`, rlsEnabled === totalTables ? '#10b981' : '#ef4444');
      addLine('Public Access Tables', String(publicAccess), publicAccess === 0 ? '#10b981' : '#ef4444');
      addLine('Total Policies', String((infrastructure.policies || []).reduce((s: number, p: any) => s + Number(p.policy_count), 0)));
      addLine('Total Indexes', String((infrastructure.indexes || []).reduce((s: number, p: any) => s + Number(p.index_count), 0)));
    }
    y += 4;

    addTitle('Storage Security');
    if (infrastructure?.buckets) {
      const publicBuckets = infrastructure.buckets.filter((b: any) => b.public);
      addLine('Total Buckets', String(infrastructure.buckets.length));
      addLine('Public Buckets', String(publicBuckets.length), publicBuckets.length === 0 ? '#10b981' : '#ef4444');
      infrastructure.buckets.forEach((b: any) => {
        addLine(`  ${b.name}`, b.public ? 'PUBLIC' : 'Private', b.public ? '#ef4444' : '#10b981');
      });
    }
    y += 4;

    addTitle('Edge Functions');
    if (edgeFunctions && edgeFunctions.length > 0) {
      addLine('Total Functions', String(edgeFunctions.length));
      const noJWT = edgeFunctions.filter((f: any) => !f.verify_jwt).length;
      addLine('Without JWT Auth', String(noJWT), noJWT === 0 ? '#10b981' : '#ef4444');
      edgeFunctions.forEach((f: any) => {
        addLine(`  ${f.slug}`, f.verify_jwt ? 'JWT' : 'NO JWT', f.verify_jwt ? '#10b981' : '#f59e0b');
      });
    } else {
      addLine('Live data', 'Not available');
    }
    y += 4;

    addTitle('Emergency Controls');
    const activeEmergencies = Object.entries(emergencySettings).filter(([, v]) => v === 'true');
    addLine('Active Controls', String(activeEmergencies.length), activeEmergencies.length > 0 ? '#ef4444' : '#10b981');
    if (activeEmergencies.length > 0) {
      activeEmergencies.forEach(([key]) => {
        const label = key.replace('emergency_', '').replace(/_/g, ' ');
        addLine(`  ${label}`, 'ACTIVE', '#ef4444');
      });
    } else {
      addLine('  No emergencies active', 'OK', '#10b981');
    }
    y += 4;

    addTitle('Security Timeline (Last Events)');
    const recentEvents = [...(loginEvents || []), ...(resetEvents || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    recentEvents.forEach((event: any) => {
      const date = new Date(event.created_at).toLocaleString('en-GB');
      addLine(date, `${event.action_type} — ${event.admin_username || 'unknown'}`);
    });
    if (recentEvents.length === 0) {
      addLine('No events', '—');
    }
    y += 4;

    addTitle('Recommendations');
    const recommendations: string[] = [];
    if (stats.failedLogins > 5) recommendations.push('Review failed admin login patterns — consider stricter rate limiting');
    if (infrastructure?.tables) {
      const noRLS = infrastructure.tables.filter((t: any) => t.schema_name === 'app' && !t.rls_enabled);
      if (noRLS.length > 0) recommendations.push(`${noRLS.length} table(s) missing RLS — enable immediately: ${noRLS.map((t: any) => t.table_name).join(', ')}`);
    }
    if (edgeFunctions && edgeFunctions.length > 0) {
      const noJWT = edgeFunctions.filter((f: any) => !f.verify_jwt);
      if (noJWT.length > 0) recommendations.push(`${noJWT.length} function(s) without JWT auth — review: ${noJWT.map((f: any) => f.slug).join(', ')}`);
    }
    if (activeEmergencies.length > 0) recommendations.push(`${activeEmergencies.length} emergency control(s) active — review and disable when resolved`);
    if (recommendations.length === 0) recommendations.push('All security checks passed. Continue monitoring regularly.');

    recommendations.forEach((rec, i) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      doc.text(`${i + 1}. ${rec}`, margin, y, { maxWidth: contentW });
      y += 7;
    });

    y += 8;
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('This report was automatically generated by QuickGuard Security Operations Centre.', margin, y);
    y += 5;
    doc.text(`Report ID: QG-SEC-${Date.now().toString(36).toUpperCase()}`, margin, y);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setReportUrl(url);
    setGenerating(false);
    setReportReady(true);
  };

  const handleDownload = () => {
    if (reportUrl) {
      const a = document.createElement('a');
      a.href = reportUrl;
      a.download = `QuickGuard-Security-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const score = computeScore();
  const scoreLabel = getScoreLabel(score);
  const scoreColor = getScoreColor(score);

  const tableIssues = infrastructure?.tables ? infrastructure.tables.filter((t: any) => t.schema_name === 'app' && !t.rls_enabled).length : '—';
  const bucketIssues = infrastructure?.buckets ? infrastructure.buckets.filter((b: any) => b.public).length : '—';
  const fnIssues = edgeFunctions && edgeFunctions.length > 0 ? edgeFunctions.filter((f: any) => !f.verify_jwt).length : '—';
  const activeEmergencies = Object.values(emergencySettings).filter(v => v === 'true').length;
  const totalIssues = (typeof tableIssues === 'number' ? tableIssues : 0) + (typeof bucketIssues === 'number' ? bucketIssues : 0) + (typeof fnIssues === 'number' ? fnIssues : 0) + activeEmergencies + (stats.failedLogins > 5 ? 1 : 0);

  const issueLabel = totalIssues === 0 ? 'None' : totalIssues <= 2 ? 'Low' : totalIssues <= 5 ? 'Moderate' : 'High';

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 flex items-center justify-center bg-purple-500/10 rounded-lg">
              <i className="ri-file-pdf-2-line text-purple-400 text-sm"></i>
            </div>
            <h2 className="text-base font-semibold text-white">Security Report</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate a comprehensive PDF security report with real-time aggregated data from all security audits — authentication, database, storage, edge functions, emergency controls, and recommendations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reportReady && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
              <i className="ri-check-fill"></i>
              Report Ready
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              generating
                ? 'bg-slate-500/20 text-slate-400 cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                Aggregating & Generating...
              </>
            ) : (
              <>
                <i className="ri-file-pdf-2-line"></i>
                Generate Security Report
              </>
            )}
          </button>
          {reportReady && reportUrl && (
            <button
              onClick={handleDownload}
              className="px-4 py-2.5 text-sm font-medium bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20 hover:bg-teal-500/20 transition cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-download-line"></i>
              Download PDF
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#1a2b4a]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#0a1628] rounded-lg px-3 py-2">
            <span className="text-slate-500">Report Date</span>
            <p className="text-slate-300 font-medium mt-0.5">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg px-3 py-2">
            <span className="text-slate-500">Overall Score</span>
            <p className="font-bold mt-0.5" style={{ color: scoreColor }}>{score}% — {scoreLabel}</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg px-3 py-2">
            <span className="text-slate-500">Issues Found</span>
            <p className="font-bold mt-0.5" style={{ color: totalIssues > 5 ? '#ef4444' : totalIssues > 2 ? '#f59e0b' : '#10b981' }}>{totalIssues} — {issueLabel}</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg px-3 py-2">
            <span className="text-slate-500">Data Sources</span>
            <p className="text-slate-300 font-medium mt-0.5">Live audit</p>
          </div>
        </div>
      </div>
    </div>
  );
}