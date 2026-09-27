import type { Metadata } from 'next';
import './globals.css';
import './league-theme.css';
import { leagueBrand } from '@/lib/league-theme';
import { SITE_LEAGUE } from '@/lib/site-league';
const brand = leagueBrand(SITE_LEAGUE);
export const metadata: Metadata = {
  title: brand.title + ' · wyniki na żywo',
  description: `Półfinały, finały i wyniki gem po gemie. ${brand.name} — śledź mecze na żywo.`,
  icons: { icon: brand.logo, shortcut: brand.logo },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body data-league={SITE_LEAGUE}>{children}</body>
    </html>
  );
}
