'use client';
import type { ReactNode } from 'react';
import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';
export default function IndustriesHero({children}:{children:ReactNode}){
 const managed=usePublicMediaBackground('industries-hero',"https://readdy.ai/api/search-image?query=Wide%20cinematic%20montage-like%20scene%20of%20professional%20SIA-licensed%20security%20professionals%20in%20smart%20black%20uniforms%20across%20different%20UK%20working%20environments%2C%20a%20venue%20door%2C%20an%20event%20crowd%2C%20a%20construction%20site%20and%20a%20retail%20storefront%20softly%20blended%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20moody%20atmospheric%20lighting%2C%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_hub_hero_20261001&orientation=landscape");
 return <section
        className="relative min-h-[460px] flex items-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.96) 0%, rgba(11, 26, 51, 0.85) 55%, rgba(11, 26, 51, 0.5) 100%), url('${managed}')`,
        }}
      >{children}</section>;
}
