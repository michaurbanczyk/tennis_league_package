'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { BANNERS, type BannerKind } from '@/lib/sponsor-banner';

const endpoint = (kind: BannerKind) => '/api/banners?kind=' + kind;
type Meta = { version: string; custom: boolean };

function useBanner(kind: BannerKind) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(endpoint(kind), {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) setMeta((await response.json()) as Meta);
      } catch {
        // Use the default sponsors when the stored banner cannot be loaded.
      }
    }
    void refresh();
    return () => controller.abort();
  }, [kind]);
  return meta;
}

export function BannerImage({ kind, fallback }: { kind: BannerKind; fallback: ReactNode }) {
  const meta = useBanner(kind);
  const [failed, setFailed] = useState('');
  if (!meta?.custom || failed === meta.version) return <>{fallback}</>;
  const banner = BANNERS[kind];
  return (
    <img
      className={'custom-banner custom-banner-' + kind}
      src={endpoint(kind) + '&image=1&v=' + encodeURIComponent(meta.version)}
      width={banner.width}
      height={banner.height}
      alt={banner.title}
      onError={() => setFailed(meta.version)}
      decoding="async"
    />
  );
}
