import { REWARDS_REDEMPTION_NOTICE } from '@/lib/customer-guidance';

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return <>
    <aside role="status" className="bg-amber-950 text-amber-100 border-b border-amber-700 px-6 py-4 text-sm text-center">
      {REWARDS_REDEMPTION_NOTICE}
    </aside>
    {children}
  </>;
}
