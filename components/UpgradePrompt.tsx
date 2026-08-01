'use client';

import { useSafeRouter } from '@/hooks/useSafeRouter';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActivePlan, getPlansForAudience } from '@/lib/entitlements';

export default function UpgradePrompt({ feature, compact = false }: { feature: string; compact?: boolean }) {
  const router = useSafeRouter();
  const [audience, setAudience] = useState<'client' | 'guard' | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: userData } = await supabase.from('users').select('user_type').eq('id', user.id).maybeSingle();
      const aud = userData?.user_type === 'client' || userData?.user_type === 'guard' ? userData.user_type : null;
      setAudience(aud);

      if (aud) {
        const p = await getPlansForAudience(aud);
        const filtered = p.filter((plan: any) => (plan.features || []).includes(feature));
        setPlans(filtered);
      }

      const cp = await getActivePlan(user.id);
      setCurrentPlan(cp);
      setLoading(false);
    };
    load();
  }, [feature]);

  const featureName = feature.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (loading) {
    return (
      <div className={`bg-[#111d35] rounded-2xl border border-slate-700/50 flex items-center justify-center ${compact ? 'p-4' : 'p-8'}`}>
        <i className="ri-loader-4-line text-teal-400 animate-spin text-xl" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-[#111d35] rounded-xl border border-slate-700/50 p-4 text-center">
        <i className="ri-lock-line text-slate-500 text-lg mb-2 block" />
        <p className="text-sm text-slate-400 mb-2">{featureName} is a premium feature</p>
        <Link
          href={`/upgrade?reason=${feature}`}
          prefetch={false}
          className="text-xs bg-teal-500 text-slate-900 font-bold px-3 py-1.5 rounded-lg hover:bg-teal-400 transition-colors whitespace-nowrap"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-8 text-center">
      <div className="w-16 h-16 bg-teal-500/10 rounded-2xl border border-teal-400/20 flex items-center justify-center mx-auto mb-4">
        <i className="ri-lock-unlock-line text-3xl text-teal-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Unlock {featureName}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">
        This feature requires a subscription upgrade.
        {currentPlan && (
          <span className="block mt-1 text-slate-500">
            Current plan: <span className="text-slate-300 font-semibold">{currentPlan.plan_name}</span>
          </span>
        )}
      </p>

      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto mb-6">
          {plans.map((plan) => (
            <div key={plan.slug} className="bg-[#0e1628] rounded-xl border border-slate-700/50 p-4 text-left">
              <h4 className="font-semibold text-white">{plan.name}</h4>
              <p className="text-sm text-slate-400 mb-3">{plan.monthly_price_pence > 0 ? `£${(plan.monthly_price_pence / 100).toFixed(0)}/mo` : 'Free'}</p>
              <Link
                href={`/upgrade?reason=${feature}&plan=${plan.slug}`}
                prefetch={false}
                className="w-full block text-center bg-teal-500 text-slate-900 font-bold py-2 rounded-lg hover:bg-teal-400 transition-colors whitespace-nowrap text-sm"
              >
                Select {plan.name}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm mb-6">No plans available for this feature.</p>
      )}

        <button
        onClick={() => router.back()}
        className="text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer"
      >
        Go back
      </button>
    </div>
  );
}