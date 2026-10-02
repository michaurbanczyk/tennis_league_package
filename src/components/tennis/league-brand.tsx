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
            <span className="rtl-wordmark-tagline" aria-label="mecze, które znaczą więcej">
              <span aria-hidden="true">
                mecze, które znacz<span className="rtl-wordmark-ogonek">a</span> wi
                <span className="rtl-wordmark-ogonek">e</span>cej
              </span>
            </span>
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
