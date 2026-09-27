/** Empty is allowed; every stored link must open YouTube over HTTPS. */
export function normalizeYoutubeUrl(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 2048)
    throw Error('Wpisz prawidłowy link do transmisji YouTube.');
  const text = value.trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)
    )
      throw Error();
    return url.href;
  } catch {
    throw Error('Wpisz link do YouTube zaczynający się od https://.');
  }
}
