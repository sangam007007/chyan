import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import api from '@/services/api';

// Fetched pictures are kept for the session so scrolling back never downloads them again
const cache = new Map<string, string>();

/**
 * An <img> for pictures that live behind the login. A plain <img src> cannot send the access token,
 * so the picture is fetched through the API client and shown from a local blob URL.
 */
export function AuthImage({ src, alt, ...rest }: { src: string; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const [url, setUrl] = useState<string | null>(cache.get(src) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cache.has(src)) { setUrl(cache.get(src)!); return; }
    let cancelled = false;
    setFailed(false);
    api.get(src, { responseType: 'blob' })
      .then((res) => {
        const blobUrl = URL.createObjectURL(res.data as Blob);
        cache.set(src, blobUrl);
        if (!cancelled) setUrl(blobUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [src]);

  if (failed) return <span className="inline-block px-3 py-6 text-xs text-gray-400">🖼 {alt}</span>;
  if (!url) return <span className="inline-block w-40 h-28 rounded-xl bg-primary-100 animate-pulse" aria-hidden="true" />;
  return <img src={url} alt={alt} {...rest} />;
}
