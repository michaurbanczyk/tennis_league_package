import type { LeagueTheme } from './league-theme';
// Fixed per deployment. Each Site owns its own D1 database and sessions.
export const SITE_LEAGUE: LeagueTheme = 'relaksmisja';
export const LEAGUE_URLS = {
  smart: 'https://smarttenis-live.sss115.chatgpt.site',
  relaksmisja: 'https://relaksmisja-live.sss115.chatgpt.site',
};

export const LEAGUE_FEATURES = { bracketEditor: true };
