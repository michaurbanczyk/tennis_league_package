'use client';
import { BannerImage } from './banner-settings';
const sponsors = [
  {
    src: '/sponsors/relaksmisja-tennis-league-ks-grzegorzecki.jpeg',
    name: 'KS Grzegórzecki',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-relaksmisja-tennis-tours.jpeg',
    name: 'Relaksmisja Tennis Tours',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-ta.jpeg',
    name: 'Turkish Airlines',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-krakow-airport.jpeg',
    name: 'Kraków Airport',
  },
  {
    src: '/sponsors/grzegorzecki-wilson.jpeg',
    name: 'Wilson',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-bmw-m-cars.jpeg',
    name: 'BMW M-Cars Group',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-recman.jpeg',
    name: 'Recman',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-studio-optyczne-a-j.jpeg',
    name: 'Studio Optyczne A&J',
  },
  {
    src: '/sponsors/grzegorzecki-strefa-tenisa.jpeg',
    name: 'Strefa Tenisa',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-la-le.jpeg',
    name: 'La-Le',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-semaprint.jpeg',
    name: 'SEMA Print',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-kafar.jpeg',
    name: 'Kafar',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-social-media-now.jpeg',
    name: 'Social Media Now',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-strojny.jpeg',
    name: 'Strojny',
  },
  {
    src: '/sponsors/klub-sportowy-grzegorzecki-drl-clinic.jpeg',
    name: 'Dr Łyszczarz Clinic',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-delsey.jpeg',
    name: 'Delsey Paris',
  },
  {
    src: '/sponsors/relaksmisja-tennis-league-mm.jpeg',
    name: 'Ministerstwo Sportu i Turystyki',
  },
  {
    src: '/sponsors/grzegorzecki-fame-sport-club.jpeg',
    name: 'Fame Sport Club',
  },
];
export function Sponsors() {
  return (
    <section className="sponsors" aria-labelledby="sponsors-title">
      <h2 id="sponsors-title">Sponsorzy i partnerzy</h2>
      <BannerImage
        kind="sponsors"
        fallback={
          <ul className="sponsors-grid">
            {sponsors.map((s) => (
              <li key={s.src}>
                <img
                  src={s.src}
                  alt={s.name}
                  width={180}
                  height={75}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
          </ul>
        }
      />
    </section>
  );
}
