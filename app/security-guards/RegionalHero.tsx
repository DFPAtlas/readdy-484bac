'use client';
import type { ReactNode } from 'react';
import QuickGuardImage from '@/components/QuickGuardImage';
import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';

export default function RegionalHero({original,children}:{original:string;children:ReactNode}) {
  const image=usePublicMediaBackground('uk-security-hero',original);
  return <section className="relative min-h-[480px] md:min-h-[560px] flex items-center bg-cover bg-center bg-no-repeat pt-20" style={{backgroundImage:`linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.82) 45%, rgba(11, 26, 51, 0.35) 100%), url('${image}')`}}>
    <QuickGuardImage src={image} alt="Professional SIA-licensed security guards across the UK" title="Professional SIA-licensed security guards across the UK" className="sr-only"/>
    {children}
  </section>;
}
