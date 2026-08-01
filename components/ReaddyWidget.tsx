'use client';

import { useEffect } from 'react';

export default function ReaddyWidget() {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.getElementById('readdy-widget-script')) return;

      const script = document.createElement('script');
      script.id = 'readdy-widget-script';
      script.src = 'https://readdy.ai/api/public/assistant/widget?projectId=0de8e08a-1549-4fde-a095-32bc66c0db0b';
      script.setAttribute('mode', 'hybrid');
      script.setAttribute('voice-show-transcript', 'true');
      script.setAttribute('theme', 'light');
      script.setAttribute('size', 'compact');
      script.setAttribute('accent-color', '#14B8A6');
      script.setAttribute('button-base-color', '#000000');
      script.setAttribute('button-accent-color', '#FFFFFF');
      script.async = true;
      document.body.appendChild(script);
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null;
}