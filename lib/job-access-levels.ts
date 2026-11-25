// Legacy job categories remain for existing client records; they do not restrict guard access.
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