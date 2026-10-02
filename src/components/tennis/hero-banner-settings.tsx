'use client';

import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { resolveHeroBanner, type HeroBanner } from '@/lib/hero-banner';
import type { Board } from '@/lib/tennis';

type Props = {
  board: Board;
  busy: boolean;
  onSave: (banner: HeroBanner) => Promise<boolean>;
};

export function HeroBannerSettings({ board, busy, onSave }: Props) {
  const banner = resolveHeroBanner(board);
  return (
    <Collapsible className="season-management hero-banner-settings">
      <CollapsibleTrigger className="season-management-trigger">
        <span>Tekst na banerze</span>
        <ChevronRight size={18} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="season-management-content">
        <form
          key={JSON.stringify(banner)}
          onSubmit={async (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            await onSave({
              kicker: String(fields.get('kicker') || ''),
              name: String(fields.get('name') || ''),
              season: String(fields.get('season') || ''),
              kickerSize: Number(fields.get('kickerSize')),
              nameSize: Number(fields.get('nameSize')),
              seasonSize: Number(fields.get('seasonSize')),
            });
          }}
        >
          <p>Dolny wiersz jest nazwą sezonu. Rozmiary czcionek podaj w pikselach.</p>
          <div className="hero-banner-fields">
            {(
              [
                {
                  key: 'kicker',
                  size: 'kickerSize',
                  label: 'Górny wiersz',
                  maxLength: 80,
                  min: 12,
                  max: 72,
                },
                {
                  key: 'name',
                  size: 'nameSize',
                  label: 'Główny napis',
                  maxLength: 120,
                  min: 16,
                  max: 96,
                },
                {
                  key: 'season',
                  size: 'seasonSize',
                  label: 'Dolny wiersz / sezon',
                  maxLength: 60,
                  min: 12,
                  max: 72,
                },
              ] as const
            ).map(({ key, size, label, maxLength, min, max }) => (
              <div className="hero-banner-field" key={key}>
                <label htmlFor={`hero-banner-${key}`}>{label}</label>
                <input
                  id={`hero-banner-${key}`}
                  name={key}
                  type="text"
                  defaultValue={banner[key]}
                  maxLength={maxLength}
                  required={key === 'season'}
                  disabled={busy}
                />
                <label htmlFor={`hero-banner-${size}`}>Rozmiar czcionki (px)</label>
                <input
                  id={`hero-banner-${size}`}
                  name={size}
                  type="number"
                  defaultValue={banner[size]}
                  min={min}
                  max={max}
                  step={1}
                  required
                  disabled={busy}
                />
              </div>
            ))}
          </div>
          <button className="button dark" disabled={busy}>
            Zapisz tekst banera
          </button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
