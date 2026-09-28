import type { Board } from '@/lib/tennis';

export type ArchiveSummary = { id: string; season: string; archivedAt: string };

export type LeagueData = Board & {
  revision: number;
  scope: string | null;
  serverTime?: string;
  archives?: ArchiveSummary[];
};

export type LeagueModal =
  | 'referee-login'
  | 'login'
  | 'admin'
  | 'create'
  | 'editor'
  | 'details'
  | 'codes'
  | 'new-season'
  | 'reset-league'
  | null;
