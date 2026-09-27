'use client';
import { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { courtGroups, type CourtGroup } from '@/lib/court-config';
import type { Board } from '@/lib/tennis';
export function readSeasonFields(form: FormData) {
  return {
    finalsDates: form.getAll('finalsDate'),
    courtGroups: JSON.parse(String(form.get('courtGroups'))),
  };
}
function CountSelect({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger aria-label={label} className="format-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {value > max && (
          <SelectItem value={String(value)} disabled>
            {value} (poprzednie ustawienie)
          </SelectItem>
        )}
        {Array.from({ length: max }, (_, i) => (
          <SelectItem key={i + 1} value={String(i + 1)}>
            {i + 1}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function SeasonFields({
  board,
  busy = false,
  newSeason = false,
}: {
  board: Board;
  busy?: boolean;
  newSeason?: boolean;
}) {
  const [dates, setDates] = useState<string[]>(() =>
    newSeason
      ? Array(Math.min(board.finalsDates?.length || 4, 10)).fill('')
      : board.finalsDates?.length
        ? [...board.finalsDates]
        : ['', '', '', ''],
  );
  const [groups, setGroups] = useState<CourtGroup[]>(() => structuredClone(courtGroups(board)));
  function countCourts(index: number, count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 32) return;
    setGroups((current) => {
      let nextId =
        Math.max(
          0,
          ...current.flatMap((g) => g.courts.map(Number)),
          ...courtGroups(board).flatMap((g) => g.courts.map(Number)),
        ) + 1;
      return current.map((g, i) =>
        i !== index
          ? g
          : {
              ...g,
              courts: Array.from({ length: count }, (_, n) => g.courts[n] || String(nextId++)),
            },
      );
    });
  }
  return (
    <div className="season-configuration">
      <fieldset>
        <legend>Terminy finałów</legend>
        <label>
          Liczba dni / terminów
          <CountSelect
            label="Liczba dni / terminów"
            max={10}
            value={dates.length}
            disabled={busy}
            onChange={(n) => setDates((old) => Array.from({ length: n }, (_, i) => old[i] || ''))}
          />
        </label>
        <div className="finals-days-grid">
          {dates.map((date, i) => (
            <label key={i}>
              Dzień {i + 1}
              <input
                type="date"
                name="finalsDate"
                required
                disabled={busy}
                value={date}
                onChange={(e) => {
                  const value = e.target.value;
                  setDates((old) => old.map((d, j) => (j === i ? value : d)));
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Obiekty i korty</legend>
        <input type="hidden" name="courtGroups" value={JSON.stringify(groups)} />
        {groups.map((group, i) => (
          <div className="court-config-row" key={group.id}>
            <label>
              Nazwa obiektu / grupy
              <input
                value={group.name}
                maxLength={60}
                placeholder="np. FAME"
                disabled={busy}
                onChange={(e) => {
                  const value = e.target.value;
                  setGroups((old) => old.map((g, j) => (i === j ? { ...g, name: value } : g)));
                }}
              />
            </label>
            <label>
              Liczba kortów
              <CountSelect
                label={`Liczba kortów — ${group.name || i + 1}`}
                max={32}
                value={group.courts.length}
                disabled={busy}
                onChange={(n) => countCourts(i, n)}
              />
            </label>
            <button
              type="button"
              className="text-button"
              disabled={busy || groups.length === 1}
              onClick={() => setGroups((old) => old.filter((g) => g.id !== group.id))}
              aria-label={`Usuń grupę ${group.name || i + 1}`}
            >
              Usuń grupę
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button outline"
          disabled={busy || groups.length >= 16}
          onClick={() =>
            setGroups((old) => [
              ...old,
              {
                id: crypto.randomUUID(),
                name: '',
                courts: [
                  String(
                    Math.max(
                      0,
                      ...old.flatMap((g) => g.courts.map(Number)),
                      ...courtGroups(board).flatMap((g) => g.courts.map(Number)),
                    ) + 1,
                  ),
                ],
              },
            ])
          }
        >
          Dodaj obiekt / grupę kortów
        </button>
      </fieldset>
    </div>
  );
}
