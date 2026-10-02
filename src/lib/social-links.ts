export const SOCIAL_PLATFORMS = [
  { key: 'openLeague', label: 'Open League', image: '/social/open-league.png' },
  { key: 'instagram', label: 'Instagram', image: '/social/instagram.png' },
  { key: 'facebook', label: 'Facebook', image: '/social/facebook.png' },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['key'];
export type SocialLinks = Record<SocialPlatform, string>;

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  openLeague: '',
  instagram: '',
  facebook: '',
};

export function normalizeSocialLinks(input: unknown): SocialLinks {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('Podaj adresy trzech ikon.');
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some((key) => !SOCIAL_PLATFORMS.some((item) => item.key === key)))
    throw Error('Nieznana ikona.');

  const links = { ...EMPTY_SOCIAL_LINKS };
  for (const { key, label } of SOCIAL_PLATFORMS) {
    const value = values[key];
    if (typeof value !== 'string' || value.length > 2048)
      throw Error(`Podaj poprawny adres dla ${label}.`);
    if (!value.trim()) continue;
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw Error(`Podaj pełny adres HTTPS dla ${label}.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password)
      throw Error(`Podaj pełny adres HTTPS dla ${label}.`);
    links[key] = url.toString();
  }
  return links;
}
