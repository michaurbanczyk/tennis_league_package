import { courtNumber, courtLabel, dateLabel, type Board, type Match } from './tennis';

/** All rounds reserve their slot, even before the players are known. */
export function assertSlotAvailable(board: Board, match: Match) {
  const court = courtNumber(match.court, board);
  if (!court || !match.date || !match.time) return;
  for (const level of board.levels)
    for (const other of level.matches) {
      if (
        other.id !== match.id &&
        courtNumber(other.court, board) === court &&
        other.date === match.date &&
        other.time === match.time
      ) {
        throw Error(
          `Termin jest zajęty: ${dateLabel(match.date)}, godz. ${match.time}, ${courtLabel(match.court, board)}. Jest już umówiony mecz (${level.name} · ${other.stage}). Wybierz inny termin lub kort.`,
        );
      }
    }
}
