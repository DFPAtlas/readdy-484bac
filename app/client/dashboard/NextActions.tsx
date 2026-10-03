import Link from 'next/link';
import { nextJobAction } from '@/lib/client-journey';
import type { RecentJobSummary } from '@/lib/client-types';
export default function NextActions({jobs}: {jobs: RecentJobSummary[]}) {
 const actions = jobs.filter(job => nextJobAction(job).attention);
 return <section className="rounded-2xl border border-teal-500/25 bg-white dark:bg-[#111d35] p-5 mb-6" aria-label="Next steps">
  <h2 className="text-lg font-bold text-slate-900 dark:text-white">What needs doing next?</h2>
  <p className="text-sm text-slate-500 mt-1">{actions.length ? 'Choose a job below to continue from the right step.' : 'No booking action is due. Your confirmed bookings and payments are below.'}</p>
  <div className="mt-4 space-y-3">{actions.map(job => <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-[#162036] p-3"><span className="text-sm font-medium dark:text-white">{job.job_title}</span><Link className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white text-center" href={nextJobAction(job).href}>{nextJobAction(job).label}</Link></div>)}</div>
  <nav className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-teal-600 dark:text-teal-400" aria-label="Booking shortcuts"><Link href="/client/jobs">My Jobs</Link><Link href="/client/jobs?tab=confirmed">Confirmed Bookings</Link><Link href="/client/payment-centre">Payments & Refunds</Link><Link href="/client/post-job">Post a Job</Link></nav>
 </section>;
}
