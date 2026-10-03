const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFPage } = require('pdf-lib');

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
      esModuleInterop: true,
    },
  }).outputText;
  function localRequire(id) {
    if (!id.startsWith('.')) return require(id);
    const resolved = path.resolve(path.dirname(file), id);
    return load(resolved + (resolved.endsWith('.ts') ? '' : '.ts'));
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const { makeLevel, bracketRounds, propagatePlayers } = load(path.join(root, 'src/lib/tennis.ts'));
const { bracketPdfPages, createBracketPdf, pdfFileName } = load(
  path.join(root, 'src/lib/bracket-pdf.ts'),
);
const fontBytes = readFileSync(path.join(root, 'public/fonts/manrope/Manrope-Medium.ttf'));
const boldFontBytes = readFileSync(path.join(root, 'public/fonts/manrope/Manrope-Bold.ttf'));
const logoBytes = readFileSync(path.join(root, 'public/relaksmisja-logo.jpeg'));

async function verify(level, expectedPages) {
  const original = JSON.stringify(level);
  const board = { theme: 'relaksmisja', season: 'Lato 2026', levels: [level] };
  const bytes = await createBracketPdf({ board, level, fontBytes, boldFontBytes, logoBytes });
  assert.equal(JSON.stringify(level), original, 'Export must not change the live bracket');
  assert(bytes.length > 1000);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), expectedPages);
  pdf.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    assert(width > height, 'Landscape layout');
    assert(width > (expectedPages > 1 ? 1100 : 800));
  });
  if (process.env.BRACKET_PDF_SAMPLE === level.name) {
    writeFileSync(path.join(root, 'work/bracket-pdf-sample.pdf'), bytes);
  }
}

(async () => {
  for (const size of [4, 8, 16, 32]) {
    const level = makeLevel(`Test ${size}`, size, `test-${size}`);
    const firstRound = bracketRounds(level)[0].matches;
    firstRound.forEach((match, index) => {
      match.players = [`Żaneta Dąbrowska ${index}`, `Łukasz Kościuszko ${index}`];
      match.date = '2026-10-04';
      match.time = '15:00';
      match.court = '2';
    });
    assert.equal(bracketPdfPages(level).length, size === 32 ? 3 : 1);
    await verify(level, size === 32 ? 3 : 1);
    firstRound[0].status = 'finished';
    firstRound[0].winner = 0;
    firstRound[0].sets = [
      [6, 3],
      [6, 4],
    ];
    firstRound[1].status = 'live';
    firstRound[1].sets = [[4, 3]];
    await verify(level, size === 32 ? 3 : 1);
    for (const round of bracketRounds(level).filter((item) => item.size > 0)) {
      propagatePlayers(level);
      for (const match of round.matches) {
        match.status = 'finished';
        match.winner = 0;
        match.sets = [
          [6, 3],
          [6, 4],
        ];
      }
    }
    await verify(level, size === 32 ? 3 : 1);
  }

  const tieBreakLevel = makeLevel('Tie-break', 4, 'tie-break');
  const tieBreakMatch = tieBreakLevel.matches[0];
  tieBreakMatch.players = ['Zawodnik A', 'Zawodnik B'];
  tieBreakMatch.status = 'finished';
  tieBreakMatch.winner = 0;
  tieBreakMatch.sets = [
    [7, 6],
    [6, 4],
  ];
  tieBreakMatch.tieBreaks = { 0: [13, 11] };
  const drawnTieBreakPoints = [];
  const originalDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    if (text === '13' || text === '11') drawnTieBreakPoints.push({ text, size: options.size });
    return originalDrawText.call(this, text, options);
  };
  try {
    await verify(tieBreakLevel, 1);
  } finally {
    PDFPage.prototype.drawText = originalDrawText;
  }
  assert.deepEqual(drawnTieBreakPoints.map((item) => item.text).sort(), ['11', '13']);
  assert(
    drawnTieBreakPoints.every((item) => item.size < 8),
    'Tie-break points use smaller type',
  );

  const empty = makeLevel('Pusta', 4, 'empty');
  await verify(empty, 1);
  await verify({ id: 'no-matches', name: 'Bez meczów', format: 'super', matches: [] }, 1);
  const doubles = makeLevel('Debel kobiet', 16, 'doubles');
  doubles.doubles = true;
  doubles.matches[0].players = [
    'Aleksandra Dąbrowska / Krystyna Nowakowska-Kowalczyk',
    'Małgorzata Świątek / Katarzyna Żółkiewska',
  ];
  doubles.matches[0].date = '2026-10-04';
  doubles.matches[0].time = '15:00';
  doubles.matches[0].court = '2';
  await verify(doubles, 1);
  assert.equal(pdfFileName('Lato 2026', 'TOP PRO'), 'RTL-Finals_Lato-2026_TOP-PRO.pdf');
  assert.equal(
    pdfFileName('Zima/2026', 'Średniozaawansowane: kobiety'),
    'RTL-Finals_Zima-2026_SREDNIOZAAWANSOWANE-KOBIETY.pdf',
  );
  console.log(
    'PASS: 4/8/16/32, empty, partial/live, finished, Polish names, long doubles, landscape, no mutation.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
