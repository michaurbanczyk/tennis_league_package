import { leagueBrand, type LeagueTheme } from '@/lib/league-theme';
export function LeagueBrand({ theme }: { theme?: LeagueTheme }) {
  const brand = leagueBrand(theme);
  return (
    <>
      <img src={brand.logo} alt={brand.name} />
      {theme === 'relaksmisja' ? (
        <>
          <span className="rtl-brand-divider" aria-hidden="true" />
          <span className="rtl-wordmark">
            <span className="rtl-wordmark-title">RTL FINALS</span>
            <span className="rtl-wordmark-tagline">mecze, które znaczą więcej</span>
          </span>
        </>
      ) : (
        <span className="brand-caption">
          FINAŁY <span>NA ŻYWO</span>
        </span>
      )}
    </>
  );
}
