'use client';
import { useMemo } from 'react';
import {
  Activity,
  BarChart3,
  CircleDot,
  Clock3,
  Flag,
  Layers3,
  RotateCcw,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { finalsStats, type MatchRecord } from '@/lib/finals-stats';
import type { Board } from '@/lib/tennis';
const num = (n: number) => n.toLocaleString('pl-PL');
const minutes = (ms: number) => Math.round(ms / 60000);
function duration(ms: number) {
  const min = minutes(ms);
  return min >= 60
    ? `${Math.floor(min / 60)} godz.${min % 60 ? ' ' + (min % 60) + ' min' : ''}`
    : `${min} min`;
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
}) {
  return (
    <article className="finals-metric">
      <div className="finals-metric-heading">
        <span className="finals-metric-icon">
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h4>{label}</h4>
      </div>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
    </article>
  );
}
function RecordCard({
  number,
  title,
  record,
  time = false,
  superTie = false,
}: {
  number: string;
  title: string;
  record: MatchRecord | null;
  time?: boolean;
  superTie?: boolean;
}) {
  return (
    <article className="finals-record">
      <div className="finals-record-heading">
        <span aria-hidden="true">{number}</span>
        <h4>{title}</h4>
      </div>
      <strong>
        {record
          ? superTie
            ? record.match.sets[2].join(':')
            : time
              ? duration(record.value)
              : `${num(record.value)} gemów`
          : '—'}
      </strong>
      {record ? (
        <>
          <p className="finals-record-players">{record.match.players.join(' vs ')}</p>
          <p className="finals-record-score">
            {record.match.sets.map((s, setIndex) => (
              <span key={setIndex}>
                {setIndex > 0 ? ', ' : ''}
                {s[0]}
                {record.match.tieBreaks?.[String(setIndex)]?.[0] !== undefined && (
                  <sup className="result-tiebreak-score">
                    {record.match.tieBreaks[String(setIndex)][0]}
                  </sup>
                )}
                :{s[1]}
                {record.match.tieBreaks?.[String(setIndex)]?.[1] !== undefined && (
                  <sup className="result-tiebreak-score">
                    {record.match.tieBreaks[String(setIndex)][1]}
                  </sup>
                )}
              </span>
            ))}
          </p>
          <small>
            {record.level}
            {superTie ? ` · ${num(record.value)} punktów łącznie` : ''}
          </small>
        </>
      ) : (
        <p>
          {superTie
            ? 'Brak zakończonych super tie-breaków.'
            : `Brak zakończonych meczów${time ? ' z zapisanym czasem' : ''}.`}
        </p>
      )}
    </article>
  );
}
export function FinalsSummary({ board }: { board: Board }) {
  const stats = useMemo(() => finalsStats(board), [board]),
    s = stats.total;
  const frequent = s.frequent.join(' / ') || '—';
  const progress = s.total ? Math.round((s.played / s.total) * 100) : 0;
  return (
    <section className="finals-summary" aria-label="Statystyki">
      <div className="results-top">
        <div>
          <h2>Statystyki</h2>
          <p className="finals-subtitle">Aktualizowane na bieżąco</p>
        </div>
      </div>
      <div className="finals-overview" aria-label="Podsumowanie sezonu">
        <div className="finals-overview-main">
          <span className="finals-eyebrow">PODSUMOWANIE SEZONU</span>
          <p>Rozegrane mecze</p>
          <div className="finals-overview-count">
            <strong>{num(s.played)}</strong>
            <span>z {num(s.total)} zaplanowanych</span>
          </div>
          <div className="finals-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="finals-overview-side">
          <div>
            <strong>{progress}%</strong>
            <span>rozegranych meczów</span>
          </div>
          <div>
            <strong>
              {stats.participants.estimated ? '≈ ' : ''}
              {num(stats.participants.count)}
            </strong>
            <span>uczestników finałów</span>
            {stats.participants.estimated && (
              <small>Orientacyjnie: nierozdzielone pary liczymy jako 2 osoby.</small>
            )}
          </div>
        </div>
      </div>
      <section className="finals-section" aria-labelledby="finals-course">
        <h3 id="finals-course">Na kortach</h3>
        <div className="finals-metrics">
          <Metric
            label="Łączny czas gry"
            value={s.timed ? `${num(minutes(s.durationMs))} min` : '—'}
            icon={Clock3}
            note={
              s.timed
                ? `${num(Math.round(s.durationMs / 360000) / 10)} godz.`
                : 'Brak zapisanych czasów'
            }
          />
          <Metric
            label="Średni czas meczu"
            value={s.timed ? `${num(minutes(s.durationMs / s.timed))} min` : '—'}
            icon={Timer}
            note={s.timed ? `Mecze z zapisanym czasem: ${s.timed}` : 'Brak zapisanych czasów'}
          />
          <Metric label="Rozegrane sety" value={num(s.sets)} icon={Layers3} />
          <Metric label="Rozegrane gemy" value={num(s.games)} icon={CircleDot} />
        </div>
      </section>
      <section className="finals-section" aria-labelledby="finals-patterns">
        <h3 id="finals-patterns">Przebieg meczów</h3>
        <div className="finals-metrics">
          <Metric
            label="Najczęstszy wynik seta"
            value={frequent}
            icon={BarChart3}
            note={
              s.frequency
                ? `Wystąpienia: ${s.frequency}${s.frequent.length > 1 ? ' · każdy z wyników' : ''}`
                : 'Brak zakończonych setów'
            }
          />
          <Metric
            label="Decydująca partia"
            value={num(s.deciders)}
            icon={Flag}
            note={`Trzeci set lub super tie-break · ${s.played ? Math.round((s.deciders / s.played) * 100) : 0}% zakończonych meczów`}
          />
          <Metric
            label="Powroty po pierwszym secie"
            value={num(s.comebacks)}
            icon={RotateCcw}
            note="Zwycięstwa po przegranym pierwszym secie"
          />
          <Metric
            label="Rozegrane tie-breaki"
            value={num(s.tieBreaks)}
            icon={Activity}
            note={`Przy 6:6 · osobno super tie-breaki: ${num(s.superTieBreaks)}`}
          />
        </div>
      </section>
      <p className="finals-counting-note">
        Dane z zakończonych meczów. Czas liczymy wyłącznie dla meczów z prawidłowym rozpoczęciem i
        zakończeniem. Super tie-break liczy się jako decydujący set; jego punkty nie są gemami i nie
        wchodzą do najczęstszego wyniku seta.
      </p>
      <section className="finals-section" aria-labelledby="finals-records">
        <h3 id="finals-records">Rekordy finałów</h3>
        <div className="finals-records">
          <RecordCard number="01" title="Najdłuższy mecz" record={s.longest} time />
          <RecordCard number="02" title="Najkrótszy mecz" record={s.shortest} time />
          <RecordCard number="03" title="Najwięcej gemów w jednym meczu" record={s.mostGames} />
          <RecordCard
            number="04"
            title="Najdłuższy super tie-break"
            record={s.longestSuper}
            superTie
          />
        </div>
      </section>
      <section className="finals-section" aria-labelledby="finals-levels">
        <h3 id="finals-levels">Statystyki według poziomu</h3>
        <div className="finals-levels">
          {stats.levels.map((l) => (
            <article className="finals-level" key={l.id}>
              <div className="finals-level-heading">
                <h4>{l.name}</h4>
                <span>{l.total ? Math.round((l.played / l.total) * 100) : 0}% rozegrano</span>
                <div className="finals-level-track" aria-hidden="true">
                  <span
                    style={{ width: `${l.total ? Math.round((l.played / l.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <dl>
                <div>
                  <dt>Rozegrane mecze</dt>
                  <dd>
                    {num(l.played)} / {num(l.total)}
                  </dd>
                </div>
                <div>
                  <dt>Czas gry</dt>
                  <dd>{l.timed ? `${num(minutes(l.durationMs))} min` : '—'}</dd>
                </div>
                <div>
                  <dt>Średnio</dt>
                  <dd>{l.timed ? `${num(minutes(l.durationMs / l.timed))} min` : '—'}</dd>
                </div>
                <div>
                  <dt>Sety</dt>
                  <dd>{num(l.sets)}</dd>
                </div>
                <div>
                  <dt>Gemy</dt>
                  <dd>{num(l.games)}</dd>
                </div>
                <div>
                  <dt>Najczęstszy wynik seta</dt>
                  <dd>{l.frequent.join(' / ') || '—'}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!stats.levels.length && (
            <p className="schedule-empty">W tym sezonie nie utworzono jeszcze meczów finałowych.</p>
          )}
        </div>
      </section>
    </section>
  );
}
