import CompanyAuthGate from '@/components/CompanyAuthGate';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <CompanyAuthGate>{children}</CompanyAuthGate>;
}