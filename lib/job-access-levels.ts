const PLAN_ACCESS_LEVELS: Record<string, number> = {
  guard_starter: 0,
  'guard-basic': 1,
  'guard-pro': 2,
  'guard-elite': 3,
};

const JOB_ACCESS_LEVELS: Record<string, number> = {
  basic: 0,
  professional: 1,
  premium: 2,
  elite: 3,
};

export function getGuardAccessLevel(planSlug: string): string {
  const map: Record<string, string> = {
    guard_starter: 'Basic',
    'guard-basic': 'Professional',
    'guard-pro': 'Premium',
    'guard-elite': 'Elite',
  };
  return map[planSlug] || 'Basic';
}

export function getGuardAccessLevelNumeric(planSlug: string): number {
  return PLAN_ACCESS_LEVELS[planSlug] ?? 0;
}

export function getJobAccessLevelNumeric(accessLevel: string): number {
  return JOB_ACCESS_LEVELS[accessLevel] ?? 0;
}

export function canAccessJob(guardPlanSlug: string, jobAccessLevel: string): boolean {
  const guardLevel = getGuardAccessLevelNumeric(guardPlanSlug);
  const jobLevel = getJobAccessLevelNumeric(jobAccessLevel);
  return guardLevel >= jobLevel;
}

export function getAccessLevelBadge(level: string): { color: string; icon: string; label: string } {
  switch (level) {
    case 'basic':
      return { color: 'bg-slate-500/15 text-slate-400 border-slate-500/25', icon: 'ri-shield-line', label: 'Basic' };
    case 'professional':
      return { color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: 'ri-shield-star-line', label: 'Professional' };
    case 'premium':
      return { color: 'bg-purple-500/15 text-purple-300 border-purple-500/25', icon: 'ri-shield-star-line', label: 'Premium' };
    case 'elite':
      return { color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: 'ri-shield-flash-line', label: 'Elite' };
    default:
      return { color: 'bg-slate-500/15 text-slate-400 border-slate-500/25', icon: 'ri-shield-line', label: 'Basic' };
  }
}