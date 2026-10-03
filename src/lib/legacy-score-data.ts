import type { Match } from './tennis';

// Accept old stored records/backups, but never restore the removed undo feature.
export function discardLegacyScoreHistory(match: Match): void {
  const legacy = match as Match & { history?: unknown; canUndo?: unknown };
  delete legacy.history;
  delete legacy.canUndo;
}
