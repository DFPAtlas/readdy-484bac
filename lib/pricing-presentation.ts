import { normalisePlanFeatures, planAllowanceText, type PublicPricingPlan } from './public-pricing';

export const clientFeatureLabels: Record<string, string> = {
  'client.post_job': 'Job postings',
  'client.ai_matching': 'AI guard matching',
  'client.email_support': 'Email support',
  'client.standard_payments': 'Standard payments',
  'client.escrow_payments': 'Standard payments',
  'client.job_templates': 'Job templates',
  'client.analytics': 'Advanced analytics',
  'client.priority_support': 'Priority support',
  'client.bulk_posting': 'Bulk posting',
  'client.dedicated_manager': 'Dedicated account manager',
  'client.unlimited_jobs': 'Unlimited jobs',
  'client.performance_analytics': 'Performance analytics',
  'client.priority_listing': 'Priority listing',
  'client.view_guard_profiles': 'View guard profiles',
  'client.advanced_matching': 'Advanced guard matching',
  'client.analytics_dashboard': 'Analytics dashboard',
  'client.direct_contact': 'Direct guard contact',
  'client.multi_site': 'Multi-site management',
  'client.team_access': 'Team access',
  'client.custom_contracts': 'Custom contracts',
  'client.api_access': 'API integration (by arrangement)',
  'client.job_history': 'Job history',
  'client.job_tracker': 'Job tracker',
};

export const guardFeatureLabels: Record<string, string> = {
  'guard.job_applications': 'Job applications',
  'guard.ai_matching': 'AI job matching',
  'guard.email_support': 'Email support',
  'guard.profile_visibility': 'Profile visibility',
  'guard.secure_payments': 'Secure payments',
  'guard.performance_analytics': 'Performance analytics',
  'guard.priority_support': 'Priority support',
  'guard.bulk_apply': 'Bulk applications',
  'guard.dedicated_manager': 'Dedicated account manager',
  'guard.unlimited_applications': 'Monthly application allowance',
  'guard.enhanced_profile': 'Enhanced profile',
  'guard.priority_listing': 'Priority listing',
  'guard.apply_job': 'Apply for jobs',
  'guard.view_jobs': 'View jobs',
  'guard.create_profile': 'Create a guard profile',
  'guard.priority_profile': 'Priority profile placement',
  'guard.profile_boost': 'Featured profile placement',
  'guard.advanced_alerts': 'Advanced job alerts',
  'guard.direct_contact': 'Direct client contact',
};

export function getFeatureLabel(key: string, audience: string): string {
  const labels = audience === 'client' ? clientFeatureLabels : guardFeatureLabels;
  return labels[key] || key.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || key;
}

export function presentPricingPlan<T extends PublicPricingPlan>(plan: T) {
  return { ...plan, features: normalisePlanFeatures(plan.features),
    badge: plan.slug === 'client-pro' ? 'RECOMMENDED' : plan.slug === 'guard-elite' ? 'MORE APPLICATIONS' : undefined,
    limitations: plan.job_limit_per_month === null ? [] : [planAllowanceText(plan)] };
}
