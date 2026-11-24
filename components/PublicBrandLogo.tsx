'use client';
import { usePathname } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import PublicMediaImage from '@/components/PublicMediaImage';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';
import { useState } from 'react';
import type { ComponentProps } from 'react';
const publicPaths = new Set(['/', '/industries','/construction-security','/event-security','/hotel-security','/retail-security','/pubs-bars-nightclubs','/security-for-building-sites','/security-for-events','/security-for-nightclubs','/security-for-shops','/security-guards','/find-a-guard','/how-it-works','/how-it-works/clients','/pricing','/contact','/help','/blog','/launch','/founding-guards','/founding-guards-offer','/security-companies','/terms','/privacy','/cookie-policy','/accessibility','/accessibility-feedback']);
type Props=ComponentProps<typeof BrandLogo>;
export default function PublicBrandLogo(props:Props){
  const path=usePathname() ?? '';
  const [failed,setFailed]=useState(false);
  const {variant='full',theme='light',className='',imgClassName='',alt=BRAND_NAME}=props;
  const enabled=publicPaths.has(path)||/^\/(security-guards|blog)\/[^/]+\/?$/.test(path);
  if(!enabled||failed)return <BrandLogo {...props}/>;
  const original=variant==='full'?(theme==='light'?BRAND_LOGO.fullLight:BRAND_LOGO.fullDark):(theme==='light'?BRAND_LOGO.symbolLight:BRAND_LOGO.symbolDark);
  return <PublicMediaImage slot={'brand-'+variant+'-'+theme} src={original} alt={alt} draggable={false} onError={()=>setFailed(true)} className={`${variant==='symbol'?'h-9 w-9':'h-9 w-auto'} object-contain select-none ${imgClassName} ${className}`.trim()}/>;
}
