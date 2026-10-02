'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, Flag, Play, Timer } from 'lucide-react';
import { dateLabel, type Match } from '@/lib/tennis';
import {
  actualStart,
  durationLabel,
  localMatchDate,
  localMatchTime,
  matchElapsed,
} from '@/lib/match-timing';
export function MatchTiming({
  match: m,
  serverTime,
  tv = false,
}: {
  match: Match;
  serverTime?: string;
  tv?: boolean;
}) {
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
  if (tv)
    return (
      <div className="tv-time-card" aria-label="Czas meczu">
        <div className="tv-time-details">
          {m.time && (
            <div>
              <span>Planowany start</span>
              <strong>{m.time}</strong>
            </div>
          )}
          <div>
            <span>Godzina rozpoczęcia</span>
            <strong>{start === null ? '—' : localMatchTime(start)}</strong>
          </div>
        </div>
        <div className="tv-time-duration">
          <span>Trwa</span>
          <strong>{elapsed === null ? '—' : `${Math.floor(elapsed / 60000)} min`}</strong>
        </div>
      </div>
    );
  return (
    <div className="match-timing" aria-label="Terminy meczu">
      <div className="match-timing-item">
        <span title="Data meczu">
          <CalendarDays aria-hidden="true" size={13} /> Data
        </span>
        <strong>{m.date ? dateLabel(m.date) : 'Do ustalenia'}</strong>
      </div>
      <div className="match-timing-item">
        <span title="Planowany start">
          <Clock3 aria-hidden="true" size={13} /> Plan
        </span>
        <strong>{m.time || '—'}</strong>
      </div>
      <div className="match-timing-item">
        <span title="Faktyczny start">
          <Play aria-hidden="true" size={13} /> Start
        </span>
        <strong>{start === null ? '—' : localMatchTime(start)}</strong>
        {start !== null && m.date && localMatchDate(start) !== m.date && (
          <small>{localMatchDate(start)}</small>
        )}
      </div>
      <div className="match-timing-item">
        <span title={m.status === 'unfinished' ? 'Czas trwania · przerwany' : 'Czas trwania'}>
          <Timer aria-hidden="true" size={13} /> Czas
        </span>
        <strong className="match-duration">
          {elapsed === null ? '—' : durationLabel(elapsed)}
        </strong>
      </div>
      <div className="match-timing-item">
        <span title="Zakończenie">
          <Flag aria-hidden="true" size={13} /> Koniec
        </span>
        <strong>{m.status === 'finished' ? m.finishedTime || '—' : '—'}</strong>
        {end && start !== null && localMatchDate(end) !== localMatchDate(start) ? (
          <small>{localMatchDate(end)}</small>
        ) : null}
      </div>
    </div>
  );
}
