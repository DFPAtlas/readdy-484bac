'use client';
import { useEffect, useState } from 'react';
import { HUMAN_SUPPORT_HOURS, humanSupportAvailable } from '@/lib/priority-support';
export default function SupportAvailability() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { const refresh = () => setAvailable(humanSupportAvailable());refresh();const timer = setInterval(refresh, 60000);return () => clearInterval(timer); }, []);
  return <aside className="rounded-xl border border-[#1e2d4d] bg-[#111d35] p-4 my-4 text-sm text-slate-300"><p>AI assistance is available 24/7. Human support: {HUMAN_SUPPORT_HOURS}.</p>
    {available !== null && <p className="mt-2">{available ? 'Human support hours are open.' : 'Outside human support hours. You can still submit a ticket; AI assistance remains available.'}</p>}
    <p className="mt-2">Priority-plan tickets are reviewed ahead of standard requests at the same urgency. Urgent safety incidents stay first. A response time is not guaranteed.</p>
  </aside>;
}
