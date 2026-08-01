import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hasFeature } from '@/lib/entitlements';
import { logClientActivity } from '@/lib/client-activity';
import { useSafeRouter } from './useSafeRouter';

const ROUTE_FEATURES: Record<string, string> = {
  '/client/post-job': 'client.post_job',
  '/client/jobs/tracker': 'client.job_tracker',
  '/client/reports': 'client.analytics_dashboard',
  '/client/templates': 'client.job_templates',
  '/client/sites': 'client.multi_site',
  '/client/messages': 'client.direct_contact',
  '/client/job-history': 'client.job_history',
  '/client/bulk-posting': 'client.bulk_posting',
  '/client/team-access': 'client.team_access',
};

const DYNAMIC_ROUTE_FEATURES: Record<string, string> = {
  '/client/jobs/[id]/select-guards': 'client.advanced_matching',
  '/client/jobs/[id]/payment': 'client.escrow_payments',
};

function matchFeature(pathname: string): string | null {
  const exact = ROUTE_FEATURES[pathname];
  if (exact) return exact;

  const parts = pathname.split('/').filter(Boolean);
  for (const [pattern, feature] of Object.entries(DYNAMIC_ROUTE_FEATURES)) {
    const patternParts = pattern.split('/').filter(Boolean);
    if (parts.length !== patternParts.length) continue;
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (patternParts[i] !== '[id]' && patternParts[i] !== parts[i]) {
        match = false;
        break;
      }
    }
    if (match) return feature;
  }
  return null;
}

export function useRouteGuard(userId?: string | null) {
  const router = useSafeRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const featureKey = matchFeature(pathname);
      if (!featureKey) { if (!cancelled) setChecking(false); return; }

      let uid = userId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { router.push('/'); return; }
        uid = user.id;
      }

      const ok = await hasFeature(uid, featureKey);
      if (cancelled) return;
      if (!ok) {
        if (!cancelled) setBlocked(true);
        logClientActivity({
          action_type: 'client_protected_route_blocked',
          action_description: `Blocked from ${pathname} — missing feature ${featureKey}`,
          category: 'entitlement',
          metadata: { feature_key: featureKey, route: pathname },
        }).catch(() => {});
        logClientActivity({
          action_type: 'client_upgrade_redirected',
          action_description: `Redirected to upgrade from ${pathname}`,
          category: 'entitlement',
          metadata: { feature_key: featureKey, route: pathname },
        }).catch(() => {});
        router.push(`/upgrade?reason=${featureKey}`);
        return;
      }
      if (!cancelled) setChecking(false);
    };
    check();

    return () => { cancelled = true; };
  }, [pathname, router, userId]);

  return { checking, blocked };
}