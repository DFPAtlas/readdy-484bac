'use client';
import PublicMediaImage from '@/components/PublicMediaImage';
import QuickGuardImage from '@/components/QuickGuardImage';
import { COVER_FALLBACK } from '@/lib/blog';

export default function BlogCoverImage({cover,alt,className}:{cover:string|null;alt:string;className:string}) {
  if(cover)return <QuickGuardImage src={cover} alt={alt} className={className}/>;
  return <PublicMediaImage slot="blog-cover-fallback" src={COVER_FALLBACK} alt={alt} className={className}/>;
}
