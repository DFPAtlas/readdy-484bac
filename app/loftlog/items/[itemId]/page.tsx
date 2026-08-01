import ItemDetailClient from './ItemDetailClient';

export async function generateStaticParams() {
  return [
    { itemId: 'i1' }, { itemId: 'i2' }, { itemId: 'i3' }, { itemId: 'i4' },
    { itemId: 'i5' }, { itemId: 'i6' }, { itemId: 'i7' }, { itemId: 'i8' },
    { itemId: 'i9' }, { itemId: 'i10' }, { itemId: 'i11' }, { itemId: 'i12' },
    { itemId: 'i13' }, { itemId: 'i14' }, { itemId: 'i15' }, { itemId: 'i16' },
  ];
}

export default function ItemDetailPage({ params }: { params: { itemId: string } }) {
  return <ItemDetailClient itemId={params.itemId} />;
}