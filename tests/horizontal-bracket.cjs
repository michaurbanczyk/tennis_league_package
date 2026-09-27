const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'),
  ts = require('typescript'),
  React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
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
    },
  }).outputText;
  function localRequire(id) {
    if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
    const resolved = id.startsWith('@/')
      ? path.join(root, id.slice(2))
      : path.resolve(path.dirname(file), id);
    return load(resolved + (resolved.endsWith('.tsx') || resolved.endsWith('.ts') ? '' : '.ts'));
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const { makeLevel, bracketRounds } = load(path.join(root, 'lib/tennis.ts'));
const { HorizontalBracket } = load(path.join(root, 'components/tennis/horizontal-bracket.tsx'));
const render = (level) => renderToStaticMarkup(React.createElement(HorizontalBracket, { level }));
for (const size of [4, 8, 16, 32]) {
  const level = makeLevel('Pro', size, 'test');
  for (let i = 0; i < size / 2; i++) level.matches[i].players = [`Gracz A${i}`, `Gracz B${i}`];
  const before = JSON.stringify(level),
    initial = render(level);
  assert.equal(JSON.stringify(level), before, 'Rendering cannot modify the scoreboard');
  assert.equal((initial.match(/data-bracket-match=/g) || []).length, size);
  assert(initial.includes('O 3. miejsce'));
  assert(!initial.includes('S1'));
  for (const round of bracketRounds(level).filter((r) => r.size > 0)) {
    for (const match of round.matches) {
      match.status = 'finished';
      match.winner = 0;
      match.sets = [
        [6, 3],
        [6, 4],
      ];
    }
    const html = render(level);
    assert(html.includes('knockout-winner'));
  }
  const completed = render(level);
  assert.equal(
    (completed.match(/Gracz A0/g) || []).length,
    Math.log2(size),
    'Winner reaches every subsequent round',
  );
  assert.equal(
    (completed.match(new RegExp(`Gracz A${size / 4}`, 'g')) || []).length,
    Math.log2(size),
    'Other finalist reaches final',
  );
  const first = level.matches[0];
  first.status = 'live';
  first.winner = null;
  assert.equal(
    (render(level).match(/Gracz A0/g) || []).length,
    1,
    'Undo removes withdrawn advancement from all later rounds',
  );
}
const legacy = makeLevel('Deblowe Pro', 4);
legacy.matches.forEach((m) => {
  delete m.sources;
  delete m.roundSize;
});
legacy.matches[0].players = ['Anna Kowalska / Maria Nowak', '<script> & Kowalski'];
legacy.matches[0].winner = 0;
legacy.matches[0].status = 'finished';
const html = render(legacy);
assert.equal((html.match(/Anna Kowalska \/ Maria Nowak/g) || []).length, 2);
assert(html.includes('&lt;script&gt; &amp; Kowalski'));
assert(html.includes('Przegrany: Półfinał 2'));
console.log(
  'PASS: brackets for 4/8/16/32 players, advancement, undo, bronze, doubles, legacy data and safe read-only rendering.',
);
