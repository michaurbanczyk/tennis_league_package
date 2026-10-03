const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  function localRequire(id) {
    if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
    const resolved = id.startsWith('@/')
      ? path.join(root, 'src', id.slice(2))
      : path.resolve(path.dirname(file), id);
    const target = ['.ts', '.tsx'].map((extension) => resolved + extension).find(existsSync);
    if (!target) throw Error(`Cannot resolve ${id} from ${file}`);
    return load(target);
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const { makeLevel } = load(path.join(root, 'src/lib/tennis.ts'));
const { MatchCard } = load(path.join(root, 'src/components/tennis/match-card.tsx'));
const { TvView } = load(path.join(root, 'src/components/tennis/tv-view.tsx'));
const { FinalsSummary } = load(path.join(root, 'src/components/tennis/finals-summary.tsx'));
const level = makeLevel('Top Pro', 4);
const today = '2026-10-03';
const completed = level.matches[0];
Object.assign(completed, {
  players: ['Anna Nowak', 'Maria Kowalska'],
  court: '1',
  date: today,
  time: '11:00',
  status: 'finished',
  winner: 0,
  sets: [
    [7, 6],
    [6, 4],
  ],
  tieBreaks: { 0: [8, 6] },
  currentCode: '12345',
  refereeEnabled: true,
  refereeCurrentCode: '67890',
});
const live = level.matches[1];
Object.assign(live, {
  players: ['Ewa Zielińska', 'Ola Wiśniewska'],
  court: '1',
  date: today,
  time: '12:00',
  status: 'live',
  sets: [
    [7, 6],
    [2, 1],
  ],
  tieBreaks: { 0: [9, 7] },
});
const board = { theme: 'relaksmisja', season: 'Lato 2026', levels: [level] };
const noop = () => {};
const cardProps = {
  m: completed,
  l: level,
  archived: false,
  admin: true,
  isDemo: false,
  scope: null,
  edit: noop,
  open: noop,
  board,
};
const organizerCard = renderToStaticMarkup(React.createElement(MatchCard, cardProps));
assert(organizerCard.includes('aria-label="Kod sędziego"'));
assert(organizerCard.includes('<code>67890</code>'));
assert(!organizerCard.includes('<code>12345</code>'));
const publicCard = renderToStaticMarkup(
  React.createElement(MatchCard, { ...cardProps, admin: false }),
);
assert(!publicCard.includes('67890'));
assert(!publicCard.includes('12345'));
const regularCard = renderToStaticMarkup(
  React.createElement(MatchCard, {
    ...cardProps,
    m: { ...completed, refereeEnabled: false },
  }),
);
assert(regularCard.includes('aria-label="Kod meczu"'));
assert(regularCard.includes('<code>12345</code>'));

const tv = renderToStaticMarkup(
  React.createElement(TvView, {
    board,
    today,
    online: true,
    lastSync: null,
    isDemo: false,
    onExit: noop,
  }),
);
assert(tv.includes('tv-previous-sets'), 'TV shows last completed match');
assert(tv.includes('tv-current-match'), 'TV shows current match');
assert(tv.includes('Plan</span>'), 'TV uses the short planned-start label');
assert(tv.includes('Godz. rozpoczęcia</span>'), 'TV uses the short actual-start label');
for (const points of [8, 6, 9, 7]) {
  assert(
    new RegExp(`tv-tiebreak-score[^>]*>${points}</sup>`).test(tv),
    `TV shows tie-break ${points}`,
  );
}

const stats = renderToStaticMarkup(React.createElement(FinalsSummary, { board }));
assert(stats.includes('result-tiebreak-score">8</sup>'));
assert(stats.includes('result-tiebreak-score">6</sup>'));
console.log('PASS: tie-break tallies in TV and stats; organizer and public code visibility.');
