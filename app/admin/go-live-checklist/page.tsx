import { redirect } from 'next/navigation';

export default function LegacyGoLiveChecklistPage() {
  redirect('/admin/live-test-checklist');
}
