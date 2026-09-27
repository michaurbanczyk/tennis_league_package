import type { Match } from './tennis';
const zone = 'Europe/Warsaw';
export function localMatchDate(value: number | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function localMatchTime(value: number | string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function actualStart(m: Match) {
  const n = Date.parse(m.actualStartedAt || m.startedAt || '');
  return Number.isFinite(n) ? n : null;
}
// Resolve Polish wall time against the actual day, including DST and midnight.
export function finishInstant(
  m: Match,
  time: string,
  date?: string,
  now = Date.now(),
): string | null {
  const start = actualStart(m);
  if (start === null) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Podaj prawidłową godzinę zakończenia.');
  const dates = date ? [date] : [localMatchDate(now), localMatchDate(now - 86400000)];
  const candidates: number[] = [];
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw Error('Podaj prawidłową datę zakończenia.');
    const wall = Date.parse(d + 'T' + time + ':00Z');
    if (!Number.isFinite(wall)) throw Error('Podaj prawidłową datę zakończenia.');
    for (const offset of [60, 120]) {
      const t = wall - offset * 60000;
      if (
        localMatchDate(t) === d &&
        localMatchTime(t) === time &&
        t >= Math.floor(start / 60000) * 60000 &&
        t <= now
      )
        candidates.push(Math.max(t, start));
    }
  }
  if (!candidates.length)
    throw Error(
      'Zakończenie musi przypadać po rozpoczęciu meczu i nie może być w przyszłości. Sprawdź datę i godzinę.',
    );
  return new Date(Math.max(...candidates)).toISOString();
}
export function matchElapsed(m: Match, now = Date.now()): number | null {
  const start = actualStart(m);
  if (start === null || m.status === 'scheduled') return null;
  const end =
    m.status === 'finished'
      ? Date.parse(m.finishedAt || '')
      : m.status === 'unfinished'
        ? Date.parse(m.unfinishedAt || '')
        : Math.min(now, Date.parse(m.startedAt || '') + 12 * 3600000);
  return Number.isFinite(end) && end >= start ? end - start : null;
}
export function durationLabel(ms: number, live = false) {
  const seconds = Math.floor(ms / 1000);
  if (live)
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  const min = Math.floor(seconds / 60);
  return (min >= 60 ? Math.floor(min / 60) + ' godz. ' : '') + (min % 60) + ' min';
}
