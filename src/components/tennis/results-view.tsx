import { ChevronRight, Plus, Trophy } from 'lucide-react';
import { HorizontalBracket } from '@/components/tennis/horizontal-bracket';
import { BracketPdfButton } from '@/components/tennis/bracket-pdf-button';
import { MatchCard, type MatchCardProps } from '@/components/tennis/match-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  bracketRounds,
  isDoubles,
  matchFormat,
  matchFormatLabel,
  type Board,
  type Level,
} from '@/lib/tennis';
import type { LeagueModal } from '@/lib/league-page-types';

type BaseProps = {
  view: string;
  board: Board;
  displayLoading: boolean;
  cardProps: Omit<MatchCardProps, 'm' | 'l' | 'final'>;
};

export function ResultsView({
  view,
  board,
  displayLoading,
  cardProps,
  isDemo,
  archiveId,
  resultMatchCount,
  activeLevelFilter,
  setFilter,
  resultLevels,
  admin,
  open,
}: BaseProps & {
  isDemo: boolean;
  archiveId?: string;
  resultMatchCount: number;
  activeLevelFilter: string;
  setFilter: (value: string) => void;
  resultLevels: Level[];
  admin: boolean;
  open: (type: LeagueModal, id?: string) => void;
}) {
  return (
    <>
      {view === 'results' && (
        <>
          <div className="results-top">
            <h2>
              Drabinki <span>{isDemo ? 'Podgląd' : resultMatchCount + ' meczów'}</span>
            </h2>
          </div>
          <Tabs value={activeLevelFilter} onValueChange={setFilter} className="level-tabs">
            <TabsList aria-label="Poziom rozgrywek">
              <TabsTrigger value="all">Wszystkie poziomy</TabsTrigger>
              {resultLevels.map((l) => (
                <TabsTrigger key={l.id} value={l.id}>
                  {l.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {displayLoading ? (
            <div className="loading-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : resultLevels.length === 0 ? (
            <div className="schedule-empty">
              Organizator nie ustawił jeszcze par na żadnym poziomie.
            </div>
          ) : (
            resultLevels
              .filter((l) => activeLevelFilter === 'all' || activeLevelFilter === l.id)
              .map((l) => (
                <section className="level-section" key={l.id}>
                  <div className="level-title">
                    <div>
                      <span className="level-icon">
                        <Trophy size={17} />
                      </span>
                      <h3>{l.name}</h3>
                      {board.theme === 'relaksmisja' && (
                        <BracketPdfButton
                          level={l}
                          board={board}
                          archiveId={archiveId}
                          isDemo={isDemo}
                        />
                      )}
                      <span>
                        {l.matches[0].players.some(Boolean)
                          ? `${l.startSize || 4} ${isDoubles(l) ? 'par' : 'zawodników'} · ${l.matches.length} ${l.matches.length === 4 ? 'mecze' : 'meczów'}`
                          : 'Pary do ustalenia'}
                      </span>
                    </div>
                    <span className="format-label">
                      {admin &&
                        !l.matches.some(
                          (m) => m.configured || m.players.some(Boolean) || m.currentCode,
                        ) && (
                          <button className="text-button" onClick={() => open('create', l.id)}>
                            <Plus size={15} /> Ustaw drabinkę
                          </button>
                        )}
                      {new Set(l.matches.map((m) => matchFormat(l, m))).size > 1
                        ? 'Format zależny od rundy'
                        : matchFormatLabel(l, l.matches[0])}
                    </span>
                  </div>
                  {(l.bracketConfigured ||
                    l.matches.some(
                      (m) =>
                        m.configured ||
                        m.players.some(Boolean) ||
                        m.court ||
                        m.date ||
                        m.time ||
                        m.currentCode ||
                        m.status !== 'scheduled',
                    )) && (
                    <>
                      <HorizontalBracket
                        level={l}
                        onEdit={admin ? (m) => open('details', m.id) : undefined}
                      />
                      {(l.startSize || 4) === 4 ? (
                        <div className="bracket-layout">
                          <div className="semis">
                            <div className="round-title">
                              <span>01</span> PÓŁFINAŁY
                            </div>
                            <div className="semis-grid">
                              {l.matches.slice(0, 2).map((m) => (
                                <MatchCard {...cardProps} key={m.id} m={m} l={l} />
                              ))}
                            </div>
                          </div>
                          <div className="bracket-arrow">
                            <ChevronRight size={22} />
                          </div>
                          <div className="final">
                            <div className="round-title">
                              <span>02</span> FINAŁ <Trophy size={14} />
                            </div>
                            <MatchCard {...cardProps} m={l.matches[2]} l={l} final />
                            {l.matches[3] && (
                              <>
                                <div className="round-title bronze-title">
                                  <span>03</span> O 3. MIEJSCE
                                </div>
                                <MatchCard {...cardProps} m={l.matches[3]} l={l} />
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="extended-bracket">
                          {bracketRounds(l).map((round) => (
                            <section className="bracket-round-section" key={round.size}>
                              <h4 className="round-title">{round.title}</h4>
                              <div className="round-matches">
                                {round.matches.map((m) => (
                                  <MatchCard
                                    {...cardProps}
                                    key={m.id}
                                    m={m}
                                    l={l}
                                    final={m.stage === 'Finał'}
                                  />
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              ))
          )}
        </>
      )}
    </>
  );
}
