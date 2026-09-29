export type LeagueTheme = 'smart' | 'relaksmisja';
export function leagueBrand(theme?: LeagueTheme) {
  return theme === 'relaksmisja'
    ? {
        name: 'Tennis League',
        title: 'Finały Tennis League',
        logo: '/relaksmisja-logo.jpeg',
      }
    : { name: 'Smart Liga', title: 'Finały Smart Ligi', logo: '/smart-liga-logo.png' };
}
export const numberedSeason = /^(20\d{2}|21\d{2})\/[123]$/;
export function validateSeason(value: unknown) {
  if (typeof value !== 'string') throw Error('Wpisz nazwę sezonu.');
  const name = value.trim().normalize('NFC');
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name))
    throw Error('Nazwa sezonu musi mieć od 1 do 60 znaków.');
  return name;
}
export function seasonKey(value: string) {
  return value.trim().normalize('NFC').toLocaleLowerCase('pl-PL');
}
