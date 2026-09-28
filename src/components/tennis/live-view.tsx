import { ChevronRight, Tv } from 'lucide-react';
import { MatchCard, type MatchCardProps } from '@/components/tennis/match-card';
import { YoutubeLink } from '@/components/tennis/youtube-link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  courtLabel,
  dateLabel,
  liveCourts,
  playerPlaceholder,
  seededPlayerName,
  type Board,
} from '@/lib/tennis';

type BaseProps = {
  view: string;
  board: Board;
  displayLoading: boolean;
  cardProps: Omit<MatchCardProps, 'm' | 'l' | 'final'>;
};

export function LiveView({
  view,
  board,
  displayLoading,
  cardProps,
  archived,
  enterTv,
  hasLive,
  hasWaiting,
  today,
  setSelectedDate,
  setView,
  liveCourtList,
}: BaseProps & {
  archived: boolean;
  enterTv: () => void;
  hasLive: boolean;
  hasWaiting: boolean;
  today: string;
  setSelectedDate: (value: string) => void;
  setView: (value: string) => void;
  liveCourtList: ReturnType<typeof liveCourts>;
}) {
  return (
    <>
      {view === 'live' && !archived && (
        <section className="live-view" aria-label="Wyniki na żywo">
          <div className="results-top live-view-heading">
            <h2>Wyniki na żywo</h2>
            <button className="button outline" disabled={displayLoading} onClick={enterTv}>
              <Tv size={18} /> Widok TV
            </button>
          </div>
          <p className="schedule-note">Teraz na kortach i kolejne mecze w kolejce.</p>
          {displayLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <>
              {!hasLive && (
                <p className="live-empty-message">Obecnie żaden mecz nie jest rozgrywany</p>
              )}
              {!hasLive && !hasWaiting ? (
                <div className="live-empty-state">
                  <p>Na dziś nie ma kolejnych zaplanowanych meczów</p>
                  <button
                    className="button outline"
                    onClick={() => {
                      setSelectedDate(today);
                      setView('schedule');
                    }}
                  >
                    Zobacz plan gier <ChevronRight size={17} />
                  </button>
                </div>
              ) : (
                <div className="court-grid live-court-grid">
                  {liveCourtList.map((court) => (
                    <section className="court-column" key={court.number}>
                      <div className="court-heading">
                        <h4>{courtLabel(String(court.number), board)}</h4>
                        <span>{court.live.length ? 'W grze' : 'Brak meczu na żywo'}</span>
                      </div>
                      {court.live.map(({ m, l }) => (
                        <div className="live-current-match" key={m.id}>
                          <div className="schedule-slot">
                            <span>{l.name}</span>
                          </div>
                          <MatchCard {...cardProps} m={m} l={l} final={m.stage === 'Finał'} />
                        </div>
                      ))}
                      {court.waiting.length > 0 ? (
                        <>
                          <h5 className="live-queue-title">
                            {court.live.length ? 'KOLEJNE NA TYM KORCIE' : 'OCZEKUJĄCE DZIŚ'}
                          </h5>
                          <ol className="live-queue">
                            {court.waiting.map(({ m, l }, i) => (
                              <li key={m.id}>
                                <div className="live-queue-time">
                                  <strong>{m.time || '—'}</strong>
                                  {m.date !== today && <span>{dateLabel(m.date)}</span>}
                                </div>
                                <div>
                                  <div className="live-queue-meta">
                                    <span>Oczekujący</span>
                                    {i === 0 && <small>Następny mecz</small>}
                                    <YoutubeLink url={m.youtubeUrl} />
                                  </div>
                                  <p className="live-queue-players">
                                    {m.players.map((p, index) => (
                                      <span key={index}>
                                        {seededPlayerName(m, index) ||
                                          playerPlaceholder(l, m, index)}
                                      </span>
                                    ))}
                                  </p>
                                  <p className="live-queue-level">
                                    {l.name} · {m.stage}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="court-empty">
                          {court.live.length
                            ? 'Brak kolejnych meczów w tym dniu.'
                            : 'Brak oczekujących meczów na dziś.'}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              )}
              {(hasLive || hasWaiting) && (
                <p className="live-plan-note">
                  Godziny według planu. Kolejny mecz rozpocznie się po zwolnieniu kortu.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
