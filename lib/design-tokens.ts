export const DESIGN_TOKENS = {
  colors: {
    pageBg: '#0B1933',
    altBg: '#0e1628',
    cardBg: '#111d35',
    cardBgHover: '#162036',
    cardBgInput: '#0f1b30',
    border: '#1a2b4a',
    borderLight: '#1e2d4d',
    borderSection: 'slate-800/60',

    accent: '#14B8A6',
    accentHover: '#0D9488',
    accentSubtleBg: 'teal-500/10',
    accentSubtleBorder: 'teal-400/20',
    accentSubtleText: 'text-teal-400',
    accentButton: 'bg-teal-500 hover:bg-teal-400 text-slate-900',

    textHeading: '#FFFFFF',
    textBody: '#94A3B8',
    textMuted: '#64748B',

    dangerBg: 'red-500/10',
    dangerBorder: 'red-500/20',
    dangerText: 'text-red-400',

    warningBg: 'amber-500/10',
    warningBorder: 'amber-500/20',
    warningText: 'text-amber-400',

    successBg: 'emerald-500/10',
    successBorder: 'emerald-500/20',
    successText: 'text-emerald-400',

    infoBg: 'blue-500/10',
    infoBorder: 'blue-500/20',
    infoText: 'text-blue-400',
  },
} as const;

export const tw = {
  page: 'min-h-screen bg-[#0B1933]',
  card: 'bg-[#111d35] border border-[#1a2b4a] rounded-2xl',
  cardHover: 'hover:bg-[#162036] hover:border-teal-500/30',
  input: 'bg-[#111d35] border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white placeholder-slate-500',
  heading: 'text-white',
  body: 'text-slate-400',
  muted: 'text-slate-500',
  accentBadge: 'bg-teal-500/10 border border-teal-400/20 text-teal-400',
  accentBtn: 'bg-teal-500 hover:bg-teal-400 text-slate-900',
  accentBtnOutline: 'bg-teal-500/10 border border-teal-400/20 text-teal-400 hover:bg-teal-500/20',
  navActive: 'bg-teal-500/10 text-teal-400 shadow-sm ring-1 ring-teal-500/20',
  navInactive: 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white',
  navSidebarBg: 'bg-[#0B1933] border-r border-[#1a2b4a]',
  divider: 'border-[#1a2b4a]',
  toast: 'bg-[#111d35] border border-[#1a2b4a] text-white',
  skeleton: 'bg-[#1a2b4a]',
} as const;