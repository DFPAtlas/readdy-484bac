'use client';

import { useState, useEffect } from 'react';
import { hasFeature } from '@/lib/entitlements';
import { logClientActivity } from '@/lib/client-activity';
import { supabase } from '@/lib/supabase';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

export default function FeatureGate({ feature, children, fallback, loading }: FeatureGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setAllowed(false); return; }
      const ok = await hasFeature(user.id, feature);
      if (mounted) {
        setAllowed(ok);
        if (!ok) {
          logClientActivity({
            action_type: 'client_entitlement_blocked',
            action_description: `Feature gate denied: ${feature}`,
            category: 'entitlement',
            metadata: { feature_key: feature },
          }).catch(() => {});
        }
      }
    };
    check();
    return () => { mounted = false; };
  }, [feature]);

  if (allowed === null) return loading || null;
  if (!allowed) return fallback || null;
  return children;
}