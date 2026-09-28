import { Clock3, LockKeyhole, Plus, Settings2, ShieldCheck, Trophy } from 'lucide-react';
import { LiveBall } from '@/components/tennis/live-ball';
import { MatchTiming } from '@/components/tennis/match-timing';
import { YoutubeLink } from '@/components/tennis/youtube-link';
import type { LeagueModal } from '@/lib/league-page-types';
import {
  canEditMatch,
  courtLabel,
  dateLabel,
  hasMatchSchedule,
  MATCH_SCHEDULE_REQUIRED,
  matchFormat,
  matchFormatLabel,
  matchSources,
  matchWinner,
  playerPlaceholder,
  pointLabels,
  pointMode,
  scopeMatchId,
  seededPlayerName,
  setWinner,
  type Board,
  type Level,
  type Match,
} from '@/lib/tennis';

export type MatchCardProps = {
  m: Match;
  l: Level;
  final?: boolean;
  archived: boolean;
  admin: boolean;
  isDemo: boolean;
  scope: string | null;
  edit: (m: Match) => void;
  open: (type: LeagueModal, id?: string) => void;
  board: Board;
  serverTime?: string;
};

const labels = {
  live: 'W grze',
  scheduled: 'Zaplanowany',
  finished: 'Zakończony',
  unfinished: 'Mecz rozpoczęty, ale niedokończony',
};
// Keep the component type stable: polling must update scores without remounting
// the card and restarting its live animation or losing keyboard focus.
export function MatchCard({
  m,
  l,
  final = false,
  archived,
  admin,
  isDemo,
  scope,
  edit,
  open,
  board,
  serverTime,
}: MatchCardProps) {
  const waiting = !m.players.every(Boolean),
    showPoints =
      !!m.refereeEnabled &&
      (m.status === 'live' || m.status === 'unfinished') &&
      matchWinner(m.sets, matchFormat(l, m)) === null;
  return (
    <article
      className={`match-card ${showPoints ? 'point-scored' : ''} ${m.status === 'live' ? 'active-match' : ''} ${final ? 'final-card' : ''}`}
    >
      <>
        {final && (
          <div className="final-highlight">
            <div>
              <strong>FINAŁ</strong>
              <span>Mecz o 1. miejsce</span>
            </div>
            <span className="final-trophy">
              <Trophy aria-hidden="true" size={27} />
            </span>
          </div>
        )}
      </>
      <div className="card-top">
        <span className={`status ${m.status}`}>
          {m.status === 'live' && <LiveBall />}
          {waiting
            ? matchSources(l, m).length
              ? 'Oczekuje na poprzednią rundę'
              : 'Oczekuje na pary'
            : labels[m.status]}
        </span>
        <span className="court">{courtLabel(m.court, board)}</span>
      </div>
      <div className="match-format-label">{matchFormatLabel(l, m)}</div>
      <div className="score-labels">
        <span className="match-stage-name">
          {m.stage}
          <YoutubeLink url={m.youtubeUrl} />
        </span>
        <div>
          <span>S1</span>
          <span>S2</span>
          <span>{matchFormat(l, m) === 'super' ? 'STB' : 'S3'}</span>
          {showPoints && (
            <span className="point-column-label">
              {pointMode(m, matchFormat(l, m)) === 'game' ? 'Pkt' : 'TB'}
            </span>
          )}
        </div>
      </div>
      {m.players.map((p, i) => (
        <div className={`player-row ${m.winner === i ? 'winner' : ''}`} key={i}>
          <div className="player-info">
            <span className="avatar">
              {p ? (
                p
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
              ) : (
                <LockKeyhole size={16} />
              )}
            </span>
            <span>
              {seededPlayerName(m, i) || playerPlaceholder(l, m, i)}
              {m.winner === i && (
                <span className="winner-check" role="img" aria-label="Zwycięzca">
                  ✓
                </span>
              )}
            </span>
          </div>
          <div className="numbers">
            {[0, 1, 2].map((s) => (
              <span
                key={s}
                className={`${m.sets[s] && setWinner(m.sets[s], matchFormat(l, m) === 'super' && s === 2) === i ? 'won-set' : ''} ${s === m.sets.length - 1 && m.status === 'live' ? 'current-set' : ''}`}
              >
                {waiting ? '–' : (m.sets[s]?.[i] ?? '–')}
              </span>
            ))}
            {showPoints && (
              <span className="point-column-value">{pointLabels(m, matchFormat(l, m))[i]}</span>
            )}
          </div>
        </div>
      ))}
      {m.refereeEnabled && (
        <div className="referee-card-label">
          <ShieldCheck size={13} /> Mecz sędziowany
        </div>
      )}
      <div className="card-bottom">
        <span>
          <Clock3 size={14} />
          {m.date ? dateLabel(m.date) : 'Data do ustalenia'}
        </span>
      </div>
      <MatchTiming match={m} serverTime={serverTime} />

      {!archived &&
        !isDemo &&
        (admin || scopeMatchId(scope) === m.id) &&
        !hasMatchSchedule(m, board) && (
          <p className="score-schedule-note">{MATCH_SCHEDULE_REQUIRED}</p>
        )}
      {!archived &&
        ((admin && !isDemo) || scopeMatchId(scope) === m.id || (isDemo && m.status === 'live')) && (
          <div className="card-controls">
            <button
              onClick={() => edit(m)}
              disabled={waiting || (!isDemo && !hasMatchSchedule(m, board))}
            >
              <Plus size={15} />
              {isDemo
                ? 'Wypróbuj wpisywanie'
                : canEditMatch(m, scope)
                  ? 'Wpisz wynik'
                  : 'Podgląd wyniku'}
            </button>
            {admin && !isDemo && (
              <button
                className="match-settings"
                aria-label={`Edytuj mecz: ${m.stage}, ${l.name}`}
                onClick={() => open('details', m.id)}
              >
                <Settings2 size={16} /> Edytuj mecz
              </button>
            )}
          </div>
        )}
    </article>
  );
}
