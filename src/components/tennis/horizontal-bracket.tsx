'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  seededPlayerName,
  incompleteMatch,
  bracketRounds,
  matchSources,
  playerPlaceholder,
  propagatePlayers,
  type Level,
  type Match,
} from '@/lib/tennis';

/** The same match records drive both the bracket and score cards. */
export function HorizontalBracket({
  level,
  onEdit,
}: {
  level: Level;
  onEdit?: (match: Match) => void;
}) {
  const headingId = useId(),
    grid = useRef<HTMLDivElement>(null),
    [paths, setPaths] = useState('');
  const displayLevel = useMemo(() => {
    const copy = {
      ...level,
      matches: level.matches.map((m) => ({ ...m, players: [...m.players] })),
    };
    propagatePlayers(copy);
    return copy;
  }, [level]);
  const allRounds = bracketRounds(displayLevel),
    rounds = allRounds.filter((r) => r.size > 0),
    bronze = allRounds.find((r) => r.size === 0);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    let active = true;
    function measure() {
      if (!active || !element) return;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width) return;
      const nodes = new Map(
        Array.from(element.querySelectorAll<HTMLElement>('[data-bracket-match]')).map((node) => [
          node.dataset.bracketMatch,
          node.getBoundingClientRect(),
        ]),
      );
      const next: string[] = [];
      for (const match of displayLevel.matches) {
        const target = nodes.get(match.id);
        if (!target) continue;
        for (const source of matchSources(displayLevel, match)) {
          if (source.outcome !== 'winner') continue;
          const origin = nodes.get(source.matchId);
          if (!origin) continue;
          const x = origin.right - bounds.left,
            y = origin.top + origin.height / 2 - bounds.top;
          const endX = target.left - bounds.left,
            endY = target.top + target.height / 2 - bounds.top,
            middle = (x + endX) / 2;
          next.push(`M${x} ${y}H${middle}V${endY}H${endX}`);
        }
      }
      setPaths(next.join(' '));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-bracket-match]').forEach((node) => observer.observe(node));
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [displayLevel]);

  function matchNode(match: Match) {
    const showScore = match.status === 'finished' && match.players.every(Boolean);
    return (
      <div
        className={`knockout-match${onEdit && incompleteMatch(level, match) ? ' knockout-incomplete' : ''}`}
        data-bracket-match={match.id}
        role="group"
        aria-label={`${match.stage}, ${level.name}`}
      >
        {[0, 1].map((index) => {
          const player = match.players[index],
            winner = match.status === 'finished' && match.winner === index;
          const scoreLabel = match.sets
            .map((set, setIndex) => {
              const points = match.tieBreaks?.[String(setIndex)]?.[index];
              return `${set[index]}${points === undefined ? '' : ` (tie-break ${points})`}`;
            })
            .join(', ');
          return (
            <div
              key={index}
              className={`knockout-player${winner ? ' knockout-winner' : ''}${player ? '' : ' knockout-pending'}`}
            >
              <span>
                {seededPlayerName(match, index) || playerPlaceholder(displayLevel, match, index)}
              </span>
              {showScore && (
                <span className="knockout-scores" aria-label={`Wynik setów: ${scoreLabel}`}>
                  {match.sets.map((set, setIndex) => {
                    const tieBreakPoints = match.tieBreaks?.[String(setIndex)]?.[index];
                    return (
                      <span key={setIndex} aria-hidden="true">
                        {set[index]}
                        {tieBreakPoints !== undefined && (
                          <sup className="knockout-tiebreak-score">{tieBreakPoints}</sup>
                        )}
                      </span>
                    );
                  })}
                </span>
              )}
            </div>
          );
        })}
        {onEdit && (
          <button
            type="button"
            className="knockout-edit"
            onClick={() => onEdit(match)}
            aria-label={`Edytuj mecz: ${match.stage}, ${level.name}`}
          >
            Edytuj mecz{incompleteMatch(level, match) ? ' · uzupełnij dane' : ''}
          </button>
        )}
      </div>
    );
  }

  if (!rounds.length) return null;
  const slots = rounds[0].matches.length * 2;
  return (
    <section className="knockout-section" aria-labelledby={headingId}>
      <div className="knockout-heading">
        <h4 id={headingId} className="level-section-subheading">
          Drabinka pucharowa
        </h4>
        <span>Awans po zakończeniu meczu</span>
      </div>
      <div
        className="knockout-scroll"
        role="region"
        aria-label={`Drabinka: ${level.name}. Przewijaj poziomo, aby zobaczyć kolejne rundy.`}
        tabIndex={0}
      >
        <div
          ref={grid}
          className="knockout-grid"
          style={
            {
              '--knockout-columns': rounds.length,
              gridTemplateRows: `auto repeat(${slots},minmax(52px,auto))`,
            } as CSSProperties
          }
        >
          <svg className="knockout-lines" aria-hidden="true">
            <path d={paths} />
          </svg>
          {rounds.map((round, column) => {
            const span = slots / round.matches.length;
            if (round.size === 2)
              return (
                <div
                  className="knockout-slot knockout-deciding"
                  key={round.size}
                  style={{ gridColumn: column + 1, gridRow: `2 / span ${slots}` }}
                >
                  <div className="knockout-final">
                    <h5 className="knockout-round-title knockout-final-title">{round.title}</h5>
                    {round.matches.map((match) => (
                      <div key={match.id}>{matchNode(match)}</div>
                    ))}
                  </div>
                  {bronze && (
                    <div className="knockout-bronze">
                      <h5>O 3. miejsce</h5>
                      {bronze.matches.map((match) => (
                        <div key={match.id}>{matchNode(match)}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            return (
              <div className="knockout-round" key={round.size}>
                <h5 className="knockout-round-title" style={{ gridColumn: column + 1, gridRow: 1 }}>
                  {round.title}
                </h5>
                {round.matches.map((match, index) => (
                  <div
                    className="knockout-slot"
                    key={match.id}
                    style={{
                      gridColumn: column + 1,
                      gridRow: `${2 + index * span} / span ${span}`,
                    }}
                  >
                    {matchNode(match)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
