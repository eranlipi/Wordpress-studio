import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';

export function usePreview() {
  const { previewUrl, setPreviewUrl } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refresh = useCallback((newUrl?: string) => {
    const url = newUrl ?? previewUrl;
    if (!url) return;

    if (newUrl) {
      setPreviewUrl(newUrl);
    }

    if (iframeRef.current) {
      // Force reload by temporarily setting src to empty then back
      iframeRef.current.src = 'about:blank';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = url;
        }
      }, 100);
    }
  }, [previewUrl, setPreviewUrl]);

  return { previewUrl, iframeRef, refresh };
}
