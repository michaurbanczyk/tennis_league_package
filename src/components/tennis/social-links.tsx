'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  EMPTY_SOCIAL_LINKS,
  SOCIAL_PLATFORMS,
  type SocialLinks as Links,
  type SocialPlatform,
} from '@/lib/social-links';

type LinkData = { version: string; links: Links; error?: string };

export function SocialLinks() {
  const [links, setLinks] = useState<Links>(EMPTY_SOCIAL_LINKS);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/social-links', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as LinkData;
        if (active) setLinks(data.links);
      } catch {
        // Keep the icons visible when link storage is temporarily unavailable.
      }
    }
    void refresh();
    window.addEventListener('social-links-updated', refresh);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('social-links-updated', refresh);
    };
  }, []);

  return (
    <nav className="header-social-links" aria-label="Linki zewnętrzne">
      {SOCIAL_PLATFORMS.map(({ key, label, image }) => {
        const icon = <img src={image} alt="" width={36} height={36} decoding="async" />;
        return links[key] ? (
          <a
            key={key}
            className="header-social-link"
            href={links[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} — otwórz w nowej karcie`}
            title={label}
          >
            {icon}
          </a>
        ) : (
          <span
            key={key}
            className="header-social-link header-social-link-unset"
            role="img"
            aria-label={`${label} — link nieustawiony`}
            title={`${label} — link nieustawiony`}
          >
            {icon}
          </span>
        );
      })}
    </nav>
  );
}

export function SocialLinkSettings() {
  const [data, setData] = useState<LinkData | null>(null);
  const [draft, setDraft] = useState<Links>(EMPTY_SOCIAL_LINKS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/social-links', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const value = (await response.json()) as LinkData;
        if (!response.ok) throw Error(value.error);
        if (active) {
          setData(value);
          setDraft(value.links);
          setError('');
        }
      } catch (cause) {
        if (active && !controller.signal.aborted) setError((cause as Error).message);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/social-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Social-Links-Version': data.version || 'new',
        },
        body: JSON.stringify(draft),
      });
      const value = (await response.json()) as LinkData;
      if (!response.ok) {
        if (response.status === 409) {
          const latest = await fetch('/api/social-links', { cache: 'no-store' });
          if (latest.ok) {
            const fresh = (await latest.json()) as LinkData;
            setData(fresh);
          }
        }
        throw Error(value.error);
      }
      setData(value);
      setDraft(value.links);
      window.dispatchEvent(new Event('social-links-updated'));
      toast.success('Zapisano linki przy ikonach.');
    } catch (cause) {
      setError((cause as Error).message || 'Nie udało się zapisać linków.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible className="season-management social-link-settings">
      <CollapsibleTrigger className="season-management-trigger">
        <span>Linki przy ikonach w nagłówku</span>
        <ChevronRight size={18} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="season-management-content">
        <form onSubmit={save}>
          <p>Wpisz pełne adresy HTTPS. Pusta ikonka będzie widoczna, ale nie będzie klikalna.</p>
          <div className="social-link-fields">
            {SOCIAL_PLATFORMS.map(({ key, label, image }) => (
              <label key={key}>
                <img src={image} alt="" width={28} height={28} decoding="async" />
                <span>{label}</span>
                <input
                  type="url"
                  inputMode="url"
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      [key as SocialPlatform]: event.target.value,
                    }))
                  }
                  maxLength={2048}
                  placeholder="https://..."
                  disabled={busy || !data}
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="button dark" disabled={busy || !data}>
            {busy ? 'Zapisywanie…' : 'Zapisz linki'}
          </button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
