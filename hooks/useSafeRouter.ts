import { useCallback, useRef, useMemo } from 'react';
import { useRouter as useNextRouter } from 'next/navigation';

export function useSafeRouter() {
  const router = useNextRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const safePush = useCallback(
    (href: string) => {
      try {
        setTimeout(() => routerRef.current.push(href), 0);
      } catch {}
    },
    []
  );

  const safeReplace = useCallback(
    (href: string) => {
      try {
        setTimeout(() => routerRef.current.replace(href), 0);
      } catch {}
    },
    []
  );

  const safeRefresh = useCallback(() => {
    try { routerRef.current.refresh(); } catch {}
  }, []);

  return useMemo(() => ({
    push: safePush,
    replace: safeReplace,
    refresh: safeRefresh,
    back: () => { try { routerRef.current.back(); } catch {} },
    forward: () => { try { routerRef.current.forward(); } catch {} },
    prefetch: (href: string) => { try { routerRef.current.prefetch(href); } catch {} },
  }), [safePush, safeReplace, safeRefresh]);
}