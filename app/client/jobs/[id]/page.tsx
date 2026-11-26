import JobDetailClient from './JobDetailClient';

export async function generateStaticParams() {
  // Keep the existing static-export shells. Private job IDs are loaded only
  // after authentication by the client page, never by an anonymous build.
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}