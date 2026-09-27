'use client';
import { useEffect, useRef, useState } from 'react';
import type { Match } from '@/lib/tennis';
import {
  actualStart,
  durationLabel,
  localMatchDate,
  localMatchTime,
  matchElapsed,
} from '@/lib/match-timing';
export function MatchTiming({ match: m, serverTime }: { match: Match; serverTime?: string }) {
  const anchor = useRef({ server: Date.now(), received: Date.now() }),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = Date.parse(serverTime || '');
    anchor.current = { server: Number.isFinite(t) ? t : Date.now(), received: Date.now() };
    setNow(anchor.current.server);
  }, [serverTime]);
  useEffect(() => {
    if (m.status !== 'live') return;
    const timer = setInterval(
      () => setNow(anchor.current.server + Date.now() - anchor.current.received),
      1000,
    );
    return () => clearInterval(timer);
  }, [m.status]);
  const start = actualStart(m),
    elapsed = matchElapsed(m, now),
    end = m.finishedAt ? Date.parse(m.finishedAt) : null;
  return (
    <div className="match-timing" aria-label="Czas meczu">
      <div>
        <span>Planowany start</span>
        <strong>{m.time || '—'}</strong>
      </div>
      <div>
        <span>Faktyczny start</span>
        <strong>{start === null ? '—' : localMatchTime(start)}</strong>
        {start !== null && m.date && localMatchDate(start) !== m.date && (
          <small>{localMatchDate(start)}</small>
        )}
      </div>
      <div>
        <span>Czas trwania{m.status === 'unfinished' ? ' · przerwany' : ''}</span>
        <strong className="match-duration">
          {elapsed === null ? '—' : durationLabel(elapsed, m.status === 'live')}
        </strong>
      </div>
      <div>
        <span>Zakończenie</span>
        <strong>{m.status === 'finished' ? m.finishedTime || '—' : '—'}</strong>
        {end && start !== null && localMatchDate(end) !== localMatchDate(start) ? (
          <small>{localMatchDate(end)}</small>
        ) : null}
      </div>
    </div>
  );
}
