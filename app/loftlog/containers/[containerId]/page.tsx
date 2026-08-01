import ContainerDetailClient from './ContainerDetailClient';

export async function generateStaticParams() {
  return [
    { containerId: 'c1' }, { containerId: 'c2' }, { containerId: 'c3' }, { containerId: 'c4' },
    { containerId: 'c5' }, { containerId: 'c6' }, { containerId: 'c7' }, { containerId: 'c8' },
    { containerId: 'c9' }, { containerId: 'c10' },
  ];
}

export default function ContainerPage({ params }: { params: { containerId: string } }) {
  return <ContainerDetailClient containerId={params.containerId} />;
}