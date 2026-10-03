import type { LeagueData } from './league-page-types';
import type { Match } from './tennis';

export type MatchDelta = {
  kind: 'match-delta';
  baseRevision: number;
  revision: number;
  levelId: string;
  matches: Match[];
  scope: string;
  serverTime: string;
};

// A delta cannot advance the league revision across changes the browser missed.
// null requests a full refresh; an older response is already superseded.
export function mergeMatchDelta(data: LeagueData, delta: MatchDelta): LeagueData | null {
  if (delta.revision <= data.revision) return data;
  if (delta.baseRevision !== data.revision || delta.revision !== delta.baseRevision + 1)
    return null;
  const level = data.levels.find((l) => l.id === delta.levelId);
  if (!level || !delta.matches.every((m) => level.matches.some((old) => old.id === m.id)))
    return null;
  const changed = new Map(delta.matches.map((m) => [m.id, m]));
  return {
    ...data,
    revision: delta.revision,
    scope: delta.scope,
    serverTime: delta.serverTime,
    levels: data.levels.map((l) =>
      l.id === level.id ? { ...l, matches: l.matches.map((m) => changed.get(m.id) ?? m) } : l,
    ),
  };
}
