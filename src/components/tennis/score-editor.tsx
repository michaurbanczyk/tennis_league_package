import { CheckCheck, Loader2, Play, Plus, Settings2, Undo2 } from 'lucide-react';
import { MatchCard, type MatchCardProps } from '@/components/tennis/match-card';
import { RefereeScoring } from '@/components/tennis/referee';
import type { LeagueModal } from '@/lib/league-page-types';
import {
  canEditMatch,
  hasMatchSchedule,
  isDoubles,
  MATCH_SCHEDULE_REQUIRED,
  pointLabels,
  seededPlayerName,
  type Board,
  type Level,
  type Match,
} from '@/lib/tennis';

type Props = {
  modal: LeagueModal;
  match: Match | undefined;
  level: Level | undefined;
  scope: string | null;
  demoEdit: boolean;
  board: Board;
  cardProps: Omit<MatchCardProps, 'm' | 'l' | 'final'>;
  open: (type: LeagueModal, id?: string) => void;
  admin: boolean;
  scoringFormat: string;
  current: Match['sets'][number] | undefined;
  superTB: boolean | undefined;
  tieBreak: boolean | undefined;
  ready: boolean | undefined;
  newSet: boolean | undefined;
  busy: boolean;
  online: boolean;
  score: (action: string, player?: number) => Promise<void>;
  finishedDate: string;
  setFinishedDate: (value: string) => void;
  finishedTime: string;
  setFinishedTime: (value: string) => void;
  post: (action: string, extra?: Record<string, unknown>) => Promise<unknown>;
  setModal: (modal: LeagueModal) => void;
};

export function ScoreEditor({
  modal,
  match,
  level,
  scope,
  demoEdit,
  board,
  cardProps,
  open,
  admin,
  scoringFormat,
  current,
  superTB,
  tieBreak,
  ready,
  newSet,
  busy,
  online,
  score,
  finishedDate,
  setFinishedDate,
  finishedTime,
  setFinishedTime,
  post,
  setModal,
}: Props) {
  return (
    <>
      {modal === 'editor' && match && !canEditMatch(match, scope) && !demoEdit && (
        <>
          <p className="editor-hint">
            {match.refereeEnabled
              ? 'Ten mecz prowadzi sędzia. Wynik zmieniają sędzia i organizator.'
              : 'Zaloguj się kodem meczu, aby edytować wynik.'}
          </p>
          {level && <MatchCard {...cardProps} m={match} l={level} archived />}
          <button className="button outline full" onClick={() => open('login', match.id)}>
            Wpisz inny kod
          </button>
        </>
      )}
      {modal === 'editor' &&
        match &&
        canEditMatch(match, scope) &&
        !demoEdit &&
        !hasMatchSchedule(match, board) && (
          <>
            <p className="editor-hint" role="status">
              {MATCH_SCHEDULE_REQUIRED}
            </p>
            {level && <MatchCard {...cardProps} m={match} l={level} archived />}
            {admin && (
              <button className="button dark full" onClick={() => open('details', match.id)}>
                <Settings2 size={17} /> Uzupełnij dane meczu
              </button>
            )}
          </>
        )}
      {modal === 'editor' &&
        match &&
        (canEditMatch(match, scope) || demoEdit) &&
        (demoEdit || hasMatchSchedule(match, board)) && (
          <div className="editor">
            {match.status !== 'scheduled' && (
              <div className="editor-setline">
                {match.sets.map((s, i) => (
                  <span key={i}>
                    {i === 2 && scoringFormat === 'super' ? 'STB' : `Set ${i + 1}`}{' '}
                    <strong>
                      {s[0]} : {s[1]}
                    </strong>
                  </span>
                ))}
              </div>
            )}
            {match.status === 'finished' ? (
              <div className="winner-banner">
                <span className="winner-check large" aria-hidden="true">
                  ✓
                </span>
                <strong>Wygrywa {seededPlayerName(match, match.winner!)}</strong>
                <span>
                  {match.finishedTime
                    ? `Zakończono o ${match.finishedTime}`
                    : 'Wynik został zatwierdzony.'}
                </span>
              </div>
            ) : match.status === 'scheduled' ? (
              <div className="start-match-panel">
                <table
                  className="start-match-scoreboard"
                  aria-label="Zawodnicy i wynik przed rozpoczęciem meczu"
                >
                  <thead>
                    <tr>
                      <th scope="col">{level && isDoubles(level) ? 'Para' : 'Zawodnik'}</th>
                      {[0, 1, 2].map((i) => (
                        <th scope="col" key={i}>
                          {i === 2 && scoringFormat === 'super' ? 'STB' : `S${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {match.players.map((p, i) => (
                      <tr key={i}>
                        <th scope="row">
                          <span className="start-player-name">
                            {seededPlayerName(match, i) || `Zawodnik ${i + 1} — do ustalenia`}
                          </span>
                        </th>
                        {[0, 1, 2].map((set) => (
                          <td key={set} className={set === 0 ? 'start-current-score' : ''}>
                            {match.sets[set]?.[i] ?? '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  {match.players.every(Boolean)
                    ? 'Kliknij, gdy zaczniecie grać. Widzowie zobaczą „W grze” już przy wyniku 0:0.'
                    : 'Poczekaj na ustalenie obydwu zawodników.'}
                </p>
                <button
                  className="button lime full"
                  disabled={busy || !match.players.every(Boolean) || (!online && !demoEdit)}
                  onClick={() => score('start')}
                >
                  <Play size={19} /> Rozpocznij mecz
                </button>
              </div>
            ) : match.status === 'unfinished' ? (
              <div className="unfinished-match-panel">
                <p>
                  <strong>Mecz rozpoczęty, ale niedokończony</strong>
                </p>
                <p>
                  Minęło 12 godzin od rozpoczęcia. Wynik został zachowany; mecz nie jest już
                  pokazywany na żywo.
                </p>
                {match.refereeEnabled && !ready && (
                  <p>
                    Ostatnie punkty:{' '}
                    <strong>{pointLabels(match, scoringFormat).join(' : ')}</strong>
                  </p>
                )}
                {!ready && (
                  <button
                    className="button lime full"
                    disabled={busy || !online}
                    onClick={() => score('start')}
                  >
                    <Play size={19} /> Wznów mecz
                  </button>
                )}
                <p>
                  {ready
                    ? 'Możesz zatwierdzić zapisany wynik poniżej.'
                    : 'Wznów tylko wtedy, gdy wracacie do gry. Od wznowienia biegnie nowy limit 12 godzin.'}
                </p>
              </div>
            ) : match.refereeEnabled ? (
              <RefereeScoring
                match={match}
                format={scoringFormat}
                busy={busy}
                online={online}
                onPoint={(i) => score('point', i)}
              />
            ) : (
              <>
                <div className="editor-hint">
                  {ready
                    ? 'Koniec meczu — zatwierdź wynik poniżej.'
                    : !match.players.every(Boolean)
                      ? 'Poczekaj na rozstrzygnięcie półfinałów.'
                      : superTB
                        ? 'Super tie-break: wpisuj punkty, do 10 z przewagą 2.'
                        : tieBreak
                          ? '6:6 — po tie-breaku wskaż jego zwycięzcę.'
                          : 'Po zakończonym gemie kliknij zwycięzcę.'}
                </div>
                <div className="scoring-grid">
                  {match.players.map((p, i) => (
                    <div key={i}>
                      <span>
                        {seededPlayerName(match, i) ||
                          `${match.stage === 'O 3. miejsce' ? 'Przegrany' : 'Zwycięzca'} półfinału ${i + 1}`}
                      </span>
                      <strong>{newSet ? 0 : current?.[i]}</strong>
                      <button
                        className="button lime"
                        disabled={
                          busy || ready || !match.players.every(Boolean) || (!online && !demoEdit)
                        }
                        onClick={() => score('add', i)}
                      >
                        <Plus size={21} />
                        {superTB ? 'Punkt' : tieBreak ? 'Tie-break' : 'Gem'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {ready && match.status !== 'finished' && (
              <label className="finish-time-field">
                Data zakończenia meczu
                <input
                  type="date"
                  value={finishedDate}
                  onChange={(e) => setFinishedDate(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {ready && match.status !== 'finished' && (
              <label className="finish-time-field">
                Godzina zakończenia meczu
                <input
                  type="time"
                  value={finishedTime}
                  onChange={(e) => setFinishedTime(e.target.value)}
                  required
                  disabled={busy}
                />
                <span>Czas lokalny w Polsce. Możesz poprawić godzinę przed zatwierdzeniem.</span>
              </label>
            )}
            <div className="editor-actions">
              <button
                className="button outline"
                disabled={busy || !(demoEdit ? match.history?.length : match.canUndo)}
                onClick={() => score('undo')}
              >
                <Undo2 size={17} /> {match.refereeEnabled ? 'Cofnij ostatnią zmianę' : 'Cofnij'}
              </button>
              {ready && match.status !== 'finished' && (
                <button
                  className="button dark"
                  disabled={
                    busy ||
                    !/^([01]\d|2[0-3]):[0-5]\d$/.test(finishedTime) ||
                    (!online && !demoEdit)
                  }
                  onClick={() => score('finish')}
                >
                  <CheckCheck size={17} /> Zakończ mecz
                </button>
              )}
            </div>
            <p className="form-note">
              {busy ? (
                <>
                  <Loader2 size={14} className="spin" /> Zapisuję…
                </>
              ) : demoEdit ? (
                'Tryb próbny · wynik nie jest publikowany'
              ) : (
                <>
                  <CheckCheck size={15} /> Każda zmiana jest zapisywana na bieżąco.
                </>
              )}
            </p>
            {scope && scope !== 'admin' && !demoEdit && (
              <button
                className="text-button"
                onClick={async () => {
                  if (await post('logout')) setModal(null);
                }}
              >
                Zablokuj edycję na tym urządzeniu
              </button>
            )}
          </div>
        )}
    </>
  );
}
