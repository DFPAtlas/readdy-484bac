export interface CataloguePlan {
  slug: string;
  name: string;
  monthly_price_pence: number;
  features?: unknown;
}

export function planIncludesFeature(plan: CataloguePlan | null | undefined, feature: string): boolean {
  if (!plan) return false;
  let features = plan.features;
  if (typeof features === 'string') {
    try { features = JSON.parse(features); } catch { return false; }
  }
  return Array.isArray(features) && features.includes(feature);
}

export function recommendedFeaturePlan(plans: CataloguePlan[], feature: string, current?: CataloguePlan | null): string {
  if (planIncludesFeature(current, feature)) return current!.slug;
  return [...plans].filter(plan => planIncludesFeature(plan, feature))
    .sort((a, b) => a.monthly_price_pence - b.monthly_price_pence)[0]?.slug || '';
}

export function featurePlanNames(plans: CataloguePlan[], feature: string): string {
  return plans.filter(plan => planIncludesFeature(plan, feature)).map(plan => plan.name).join(', ');
}
