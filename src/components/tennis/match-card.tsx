import { LockKeyhole, Plus, Settings2, Trophy } from 'lucide-react';
import { LiveBall } from '@/components/tennis/live-ball';
import { MatchTiming } from '@/components/tennis/match-timing';
import { RefereeWhistleIcon } from '@/components/tennis/referee-whistle-icon';
import { YoutubeLink } from '@/components/tennis/youtube-link';
import type { LeagueModal } from '@/lib/league-page-types';
import {
  canEditMatch,
  courtLabel,
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
// Keep the component type stable: live updates must update scores without remounting
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
      (m.status === 'live' || m.status === 'unfinished') &&
      matchWinner(m.sets, matchFormat(l, m)) === null &&
      (m.refereeEnabled || pointMode(m, matchFormat(l, m)) === 'tie-break'),
    tieBreakInProgress = showPoints && pointMode(m, matchFormat(l, m)) === 'tie-break';
  return (
    <article
      className={`match-card ${showPoints ? 'point-scored' : ''} ${tieBreakInProgress ? 'tie-break-scored' : ''} ${m.status === 'live' ? 'active-match' : ''} ${final ? 'final-card' : ''}`}
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
      <div className="match-format-row">
        <div className="match-format-label">{matchFormatLabel(l, m)}</div>
        {m.refereeEnabled && (
          <div className="referee-card-label">
            <RefereeWhistleIcon size={13} /> Mecz sędziowany
          </div>
        )}
      </div>
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
              {m.winner === i && <span className="sr-only">, zwycięzca</span>}
            </span>
          </div>
          <div className="numbers">
            {[0, 1, 2].map((s) => {
              const tieBreakPoints = m.tieBreaks?.[String(s)]?.[i];
              return (
                <span
                  key={s}
                  className={`${m.sets[s] && setWinner(m.sets[s], matchFormat(l, m) === 'super' && s === 2) === i ? 'won-set' : ''} ${s === m.sets.length - 1 && m.status === 'live' ? 'current-set' : ''}`}
                  aria-label={
                    tieBreakPoints === undefined
                      ? undefined
                      : `Set ${s + 1}: ${m.sets[s][i]} gemów, ${tieBreakPoints} punktów tie-breaka`
                  }
                >
                  {waiting ? '–' : (m.sets[s]?.[i] ?? '–')}
                  {!waiting && tieBreakPoints !== undefined && (
                    <sup className="set-tiebreak-score" aria-hidden="true">
                      {tieBreakPoints}
                    </sup>
                  )}
                </span>
              );
            })}
            {showPoints && (
              <span className="point-column-value">{pointLabels(m, matchFormat(l, m))[i]}</span>
            )}
          </div>
        </div>
      ))}
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
            {admin && !isDemo && (
              <div
                className="match-code"
                aria-label={m.refereeEnabled ? 'Kod sędziego' : 'Kod meczu'}
              >
                <span>{m.refereeEnabled ? 'Kod sędziego' : 'Kod meczu'}</span>
                <code>
                  {m.refereeEnabled
                    ? m.refereeCurrentCode || m.refereeSavedCode || '—'
                    : m.currentCode || '—'}
                </code>
              </div>
            )}
          </div>
        )}
    </article>
  );
}
