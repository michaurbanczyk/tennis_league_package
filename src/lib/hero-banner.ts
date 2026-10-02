import { z } from 'zod';

export const heroBannerSchema = z
  .object({
    kicker: z.string().trim().max(80),
    name: z.string().trim().max(120),
    season: z.string().trim().min(1).max(60),
    kickerSize: z.number().int().min(12).max(72),
    nameSize: z.number().int().min(16).max(96),
    seasonSize: z.number().int().min(12).max(72),
  })
  .refine((banner) => Boolean(banner.kicker || banner.name || banner.season));

export type HeroBanner = z.infer<typeof heroBannerSchema>;

export function defaultHeroBanner(season?: string | null): HeroBanner {
  return {
    kicker: 'Finały',
    name: 'Relaksmisja Tennis League',
    season: season || '',
    kickerSize: 26,
    nameSize: 36,
    seasonSize: 28,
  };
}

export function resolveHeroBanner(board: { season?: string | null; heroBanner?: HeroBanner }) {
  return board.heroBanner || defaultHeroBanner(board.season);
}
