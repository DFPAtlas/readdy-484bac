import { Suspense } from 'react';
import CompanyDashboardClient from './CompanyDashboardClient';

export default function CompanyDashboardPage() {
  return <Suspense fallback={<p>Loading company dashboard…</p>}><CompanyDashboardClient /></Suspense>;
}
