import TeamAccessClient from './TeamAccessClient';
import ClientAuthGate from '@/components/ClientAuthGate';

export default function TeamAccessPage() {
  return (
    <ClientAuthGate>
      <TeamAccessClient />
    </ClientAuthGate>
  );
}