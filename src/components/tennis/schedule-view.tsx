import { MatchCard, type MatchCardProps } from '@/components/tennis/match-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { courtEntries } from '@/lib/court-config';
import {
  courtLabel,
  courtNumber,
  courtSchedule,
  dateLabel,
  type Board,
  type Match,
} from '@/lib/tennis';

type BaseProps = {
  view: string;
  board: Board;
  displayLoading: boolean;
  cardProps: Omit<MatchCardProps, 'm' | 'l' | 'final'>;
};

export function ScheduleView({
  view,
  board,
  displayLoading,
  cardProps,
  schedule,
  activeDate,
  setSelectedDate,
  courtFilter,
  setCourtFilter,
  loading,
  all,
}: BaseProps & {
  schedule: ReturnType<typeof courtSchedule>;
  activeDate: string;
  setSelectedDate: (value: string) => void;
  courtFilter: string;
  setCourtFilter: (value: string) => void;
  loading: boolean;
  all: Match[];
}) {
  return (
    <>
      {view === 'schedule' && (
        <section className="schedule-view" aria-label="Plan gier">
          <div className="results-top">
            <h2>Plan gier</h2>
          </div>
          <p className="schedule-note">Mecze według kortów, w kolejności godzin rozpoczęcia.</p>
          {displayLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : schedule.length === 0 ? (
            <div className="schedule-empty">Organizator nie ustawił jeszcze dat finałów.</div>
          ) : (
            <Tabs className="schedule-date-tabs" value={activeDate} onValueChange={setSelectedDate}>
              <TabsList aria-label="Data finałów">
                {schedule.map((day) => (
                  <TabsTrigger key={day.date} value={day.date} aria-label={dateLabel(day.date)}>
                    {dateLabel(day.date).slice(0, 5)}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Tabs
                value={courtFilter}
                onValueChange={setCourtFilter}
                className="court-filter-tabs"
              >
                <TabsList aria-label="Wybierz kort">
                  <TabsTrigger value="all">Wszystkie korty</TabsTrigger>
                  {courtEntries(board).map((c) => (
                    <TabsTrigger key={c.id} value={c.id}>
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {schedule.map((day) => (
                <TabsContent value={day.date} className="schedule-day" key={day.date}>
                  <div className={`court-grid ${courtFilter !== 'all' ? 'single-court' : ''}`}>
                    {day.courts
                      .filter(
                        (court) => courtFilter === 'all' || String(court.number) === courtFilter,
                      )
                      .map((court) => (
                        <section className="court-column" key={court.number}>
                          <div className="court-heading">
                            <h4>{courtLabel(String(court.number), board)}</h4>
                            <span>
                              {court.matches.some(({ m }) => m.status === 'live')
                                ? 'Mecz w toku'
                                : court.matches.some(({ m }) => m.status === 'scheduled')
                                  ? 'Oczekuje na mecze'
                                  : court.matches.length
                                    ? 'Mecze zakończone'
                                    : 'Brak meczów'}
                            </span>
                          </div>
                          {court.matches.length ? (
                            court.matches.map(({ m, l }) => (
                              <div className="schedule-match" key={m.id}>
                                <div className="schedule-slot">
                                  <strong>{m.time || 'Godzina do ustalenia'}</strong>
                                  <span>{l.name}</span>
                                </div>
                                <MatchCard {...cardProps} m={m} l={l} final={m.stage === 'Finał'} />
                              </div>
                            ))
                          ) : (
                            <p className="court-empty">Brak zaplanowanych meczów</p>
                          )}
                        </section>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
          {!loading &&
            all.some(
              (m) =>
                (!courtNumber(m.court, board) || !board.finalsDates?.includes(m.date || '')) &&
                m.players.some(Boolean),
            ) && (
              <p className="schedule-note">
                Mecze bez przypisanego kortu lub terminu znajdziesz w zakładce „Drabinki”.
              </p>
            )}
        </section>
      )}
    </>
  );
}
