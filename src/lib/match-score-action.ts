import { discardLegacyScoreHistory } from './legacy-score-data';
import { finishInstant } from './match-timing';
import { LEAGUE_FEATURES } from './site-league';
import {
  addPoint,
  addScore,
  hasMatchSchedule,
  MATCH_SCHEDULE_REQUIRED,
  matchFormat,
  matchWinner,
  propagatePlayers,
  startMatch,
  type Board,
  type Level,
  type Match,
} from './tennis';

export const scoreActions = new Set(['start', 'point', 'add', 'finish']);

export type ScoreAction = {
  action: string;
  player?: number;
  finishedTime?: string;
  finishedDate?: string;
};

// Shared by the legacy response and the smaller match response.
export function applyScoreAction(board: Board, level: Level, match: Match, body: ScoreAction) {
  if (LEAGUE_FEATURES.bracketEditor && !hasMatchSchedule(match, board))
    throw Error(MATCH_SCHEDULE_REQUIRED);

  if (body.action === 'start') startMatch(match);
  else if (body.action === 'point')
    addPoint(match, body.player as number, matchFormat(level, match));
  else if (body.action === 'add') {
    if (match.refereeEnabled) throw Error('W meczu sędziowanym wpisuj punkty, nie gemy.');
    if (body.player !== 0 && body.player !== 1) throw Error('Wybierz zawodnika.');
    addScore(match, body.player, matchFormat(level, match));
  } else if (body.action === 'finish') {
    const winner = matchWinner(match.sets, matchFormat(level, match));
    if (winner === null) throw Error('Mecz kończy się po wygraniu dwóch setów.');
    if (match.status === 'finished') throw Error('Mecz jest już zakończony.');
    if (match.status === 'scheduled') throw Error('Najpierw rozpocznij mecz.');
    const finishedTime = String(body.finishedTime ?? '');
    if (!finishedTime) throw Error('Podaj godzinę zakończenia meczu.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(finishedTime))
      throw Error('Wpisz prawidłową godzinę meczu.');
    const finishedAt = LEAGUE_FEATURES.bracketEditor
      ? finishInstant(match, finishedTime, body.finishedDate)
      : null;
    if (LEAGUE_FEATURES.bracketEditor) match.finishedAt = finishedAt;
    match.status = 'finished';
    match.winner = winner;
    match.finishedTime = finishedTime;
    match.unfinishedAt = null;
  } else throw Error('Nieznane działanie.');

  discardLegacyScoreHistory(match);
  propagatePlayers(level);
  match.updated = new Date().toISOString();
}
