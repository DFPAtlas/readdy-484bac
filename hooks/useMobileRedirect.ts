import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const MOBILE_BREAKPOINT = 768;

export function useMobileRedirect() {
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return { isMobile, pathname };
}

export function redirectIfMobile(type: 'guard' | 'client') {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    window.location.href = `/${type}/mobile`;
    return true;
  }
  return false;
}