import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  bracketRounds,
  courtLabel,
  dateLabel,
  matchSources,
  playerPlaceholder,
  propagatePlayers,
  seededPlayerName,
  type Board,
  type Level,
  type Match,
} from './tennis';

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const A3_LANDSCAPE: [number, number] = [1190.55, 841.89];
const NAVY = rgb(0.12, 0.19, 0.34);
const MUTED = rgb(0.38, 0.44, 0.53);
const LINE = rgb(0.78, 0.82, 0.87);
const PALE = rgb(0.94, 0.96, 0.98);
const WHITE = rgb(1, 1, 1);

type Round = ReturnType<typeof bracketRounds>[number];
type BracketPage = { rounds: Round[]; bronze: Match[]; note?: string };
type FontPair = { regular: PDFFont; bold: PDFFont };

export function pdfFileName(season: string | null | undefined, level: string) {
  const safe = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `RTL-Finals_${safe(season || 'Sezon').slice(0, 60)}_${safe(level).toUpperCase().slice(0, 60)}.pdf`;
}

export function bracketPdfPages(level: Level): BracketPage[] {
  const rounds = bracketRounds(level);
  const main = rounds.filter((round) => round.size > 0);
  const bronze = rounds.find((round) => round.size === 0)?.matches || [];
  if (!main.length) return [{ rounds: [], bronze: [] }];
  if (main[0].matches.length <= 8) return [{ rounds: main, bronze }];

  const pages: BracketPage[] = [];
  const groups = Math.ceil(main[0].matches.length / 8);
  for (let group = 0; group < groups; group++) {
    const first = main[0].matches.slice(group * 8, (group + 1) * 8);
    const included = new Set(first.map((match) => match.id));
    const pageRounds: Round[] = [{ ...main[0], matches: first }];
    for (const round of main.slice(1)) {
      const matches = round.matches.filter((match) => {
        const sources = matchSources(level, match);
        return sources.length > 0 && sources.every((source) => included.has(source.matchId));
      });
      if (matches.length) {
        pageRounds.push({ ...round, matches });
        matches.forEach((match) => included.add(match.id));
      }
    }
    pages.push({
      rounds: pageRounds,
      bronze: [],
      note: `Część ${group + 1} z ${groups} · finał i mecz o 3. miejsce na ostatniej stronie`,
    });
  }
  const included = new Set(
    pages.flatMap((page) => page.rounds.flatMap((round) => round.matches.map((m) => m.id))),
  );
  const remaining = main
    .map((round) => ({
      ...round,
      matches: round.matches.filter((match) => !included.has(match.id)),
    }))
    .filter((round) => round.matches.length);
  if (remaining.length || bronze.length)
    pages.push({ rounds: remaining, bronze, note: 'Finał i klasyfikacja końcowa' });
  return pages;
}

function lines(font: PDFFont, value: string, size: number, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let line = '';
  for (const word of words) {
    if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= width) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) result.push(line);
    line = '';
    for (const char of Array.from(word)) {
      if (font.widthOfTextAtSize(line + char, size) > width && line) {
        result.push(line);
        line = '';
      }
      line += char;
    }
  }
  if (line) result.push(line);
  return result.length ? result : [''];
}

function drawText(
  page: PDFPage,
  fonts: FontPair,
  value: string,
  x: number,
  y: number,
  size: number,
  color = NAVY,
  bold = false,
) {
  page.drawText(value, { x, y, size, font: bold ? fonts.bold : fonts.regular, color });
}

function drawCheck(page: PDFPage, x: number, y: number) {
  page.drawLine({ start: { x, y: y + 2 }, end: { x: x + 2.3, y }, thickness: 1.3, color: NAVY });
  page.drawLine({
    start: { x: x + 2.3, y },
    end: { x: x + 6.5, y: y + 6 },
    thickness: 1.3,
    color: NAVY,
  });
}

function score(match: Match, index: number) {
  if (match.status !== 'finished' && match.status !== 'live' && match.status !== 'unfinished')
    return '';
  if (match.status !== 'finished' && !match.sets.some((set) => set.some((value) => value > 0)))
    return '';
  return match.sets
    .filter((set) => match.status === 'finished' || set.some((value) => value > 0))
    .map((set) => String(set[index] ?? 0))
    .join('  ');
}

function pdfPlayerName(level: Level, match: Match, index: number) {
  const name = seededPlayerName(match, index);
  if (name) return name;
  const source = matchSources(level, match)[index];
  if (!source) return playerPlaceholder(level, match, index);
  const prior = level.matches.find((item) => item.id === source.matchId);
  return `${source.outcome === 'winner' ? 'Zwycięzca' : 'Przegrany'}: ${prior?.stage || 'poprzedni mecz'}`;
}

function drawMatch(
  page: PDFPage,
  font: FontPair,
  level: Level,
  board: Board,
  match: Match,
  x: number,
  centerY: number,
  width: number,
  height: number,
  large: boolean,
) {
  const y = centerY - height / 2;
  const pad = large ? 9 : 6;
  const stageSize = large ? 8.5 : 7;
  const nameSize = large ? 9.6 : 8;
  const metaSize = large ? 7.7 : 6.7;
  const rowHeight = large ? 25 : 16;
  const maxLines = large ? 3 : 2;
  page.drawRectangle({ x, y, width, height, color: WHITE, borderColor: LINE, borderWidth: 0.8 });
  page.drawRectangle({
    x,
    y: y + height - (large ? 17 : 14),
    width,
    height: large ? 17 : 14,
    color: PALE,
  });
  drawText(
    page,
    font,
    match.stage.toUpperCase(),
    x + pad,
    y + height - (large ? 12 : 10),
    stageSize,
    NAVY,
    true,
  );
  if (match.status === 'live')
    drawText(
      page,
      font,
      'W GRZE',
      x + width - (large ? 47 : 40),
      y + height - (large ? 12 : 10),
      stageSize,
      MUTED,
    );

  const nameWidth = width - pad * 2 - (large ? 60 : 48);
  [0, 1].forEach((index) => {
    const name = pdfPlayerName(level, match, index);
    let size = nameSize;
    let nameLines = lines(font.regular, name, size, nameWidth);
    while (nameLines.length > maxLines && size > 6.8) {
      size -= 0.3;
      nameLines = lines(font.regular, name, size, nameWidth);
    }
    const top = y + height - (large ? 23 : 19) - index * rowHeight;
    nameLines.forEach((line, lineIndex) =>
      drawText(
        page,
        font,
        line,
        x + pad,
        top - lineIndex * (large ? 8.5 : 7),
        size,
        NAVY,
        match.status === 'finished' && match.winner === index,
      ),
    );
    const result = score(match, index);
    if (result)
      drawText(
        page,
        font,
        result,
        x + width - pad - font.regular.widthOfTextAtSize(result, nameSize),
        top,
        nameSize,
        NAVY,
        match.status === 'finished' && match.winner === index,
      );
    if (match.status === 'finished' && match.winner === index)
      drawCheck(page, x + width - (large ? 60 : 48), top - 1);
  });
  const schedule = [dateLabel(match.date), match.time].filter(Boolean).join(' · ');
  const court = match.court ? courtLabel(match.court, board) : '';
  const meta = [schedule, court].filter(Boolean).join(' · ');
  if (meta) {
    const metaLines = lines(font.regular, meta, metaSize, width - pad * 2);
    metaLines
      .slice(0, 2)
      .forEach((line, index) =>
        drawText(
          page,
          font,
          line,
          x + pad,
          y + pad - 1 + (Math.min(metaLines.length, 2) - 1 - index) * (metaSize + 1),
          metaSize,
          MUTED,
        ),
      );
  }
}

function drawHeader(
  page: PDFPage,
  font: FontPair,
  logo: Awaited<ReturnType<PDFDocument['embedJpg']>>,
  board: Board,
  level: Level,
  note: string,
  pageNumber: number,
  totalPages: number,
) {
  const { width, height } = page.getSize();
  const large = width > 900;
  const margin = large ? 42 : 30;
  const logoSize = large ? 58 : 45;
  page.drawRectangle({
    x: 0,
    y: height - (large ? 100 : 86),
    width,
    height: large ? 100 : 86,
    color: NAVY,
  });
  page.drawImage(logo, {
    x: margin,
    y: height - (large ? 78 : 65),
    width: logoSize,
    height: logoSize,
  });
  const textX = margin + logoSize + 17;
  drawText(
    page,
    font,
    'Tennis League',
    textX,
    height - (large ? 35 : 30),
    large ? 16 : 12,
    WHITE,
    true,
  );
  drawText(
    page,
    font,
    `${board.season || 'Sezon finałowy'}  ·  ${level.name.toUpperCase()}`,
    textX,
    height - (large ? 59 : 49),
    large ? 12 : 9,
    WHITE,
  );
  drawText(
    page,
    font,
    'DRABINKA FINAŁOWA',
    textX,
    height - (large ? 78 : 64),
    large ? 10 : 8,
    WHITE,
  );
  if (note)
    drawText(page, font, note, margin, height - (large ? 122 : 105), large ? 10 : 8.2, MUTED);
  page.drawLine({
    start: { x: margin, y: 27 },
    end: { x: width - margin, y: 27 },
    thickness: 0.7,
    color: LINE,
  });
  drawText(
    page,
    font,
    `${level.name} · ${board.season || 'Sezon finałowy'}`,
    margin,
    13,
    large ? 8.5 : 7.3,
    MUTED,
  );
  const counter = `${pageNumber} / ${totalPages}`;
  drawText(
    page,
    font,
    counter,
    width - margin - font.regular.widthOfTextAtSize(counter, large ? 8.5 : 7.3),
    13,
    large ? 8.5 : 7.3,
    MUTED,
  );
}

function drawRoundPage(
  page: PDFPage,
  font: FontPair,
  board: Board,
  level: Level,
  plan: BracketPage,
) {
  const { width, height } = page.getSize();
  const large = width > 900;
  const margin = large ? 42 : 30;
  const gap = large ? 25 : 16;
  const cardHeight = large ? 78 : 52;
  const top = height - (large ? 145 : 126);
  const bottom = large ? 61 : 37;
  const rounds = plan.rounds;
  if (!rounds.length) {
    drawText(
      page,
      font,
      'Drabinka nie została jeszcze obsadzona.',
      margin,
      height / 2,
      large ? 16 : 12,
      MUTED,
    );
    return;
  }
  const count = rounds.length;
  const cardWidth = Math.min(large ? 280 : 270, (width - 2 * margin - gap * (count - 1)) / count);
  const startX = (width - (count * cardWidth + (count - 1) * gap)) / 2;
  const firstCount = rounds[0].matches.length;
  const pitch = (top - bottom) / firstCount;
  const positions = new Map<string, { x: number; y: number }>();
  rounds.forEach((round, column) => {
    const x = startX + column * (cardWidth + gap);
    round.matches.forEach((match, index) => {
      const sources = matchSources(level, match)
        .map((source) => positions.get(source.matchId))
        .filter((position): position is { x: number; y: number } => !!position);
      const y = sources.length
        ? sources.reduce((total, source) => total + source.y, 0) / sources.length
        : top -
          pitch *
            (index * (firstCount / round.matches.length) + firstCount / round.matches.length / 2);
      positions.set(match.id, { x, y });
    });
  });
  rounds.forEach((round) =>
    round.matches.forEach((match) => {
      const target = positions.get(match.id)!;
      matchSources(level, match).forEach((source) => {
        const prior = positions.get(source.matchId);
        if (!prior) return;
        const middle = (prior.x + cardWidth + target.x) / 2;
        page.drawLine({
          start: { x: prior.x + cardWidth, y: prior.y },
          end: { x: middle, y: prior.y },
          thickness: 1,
          color: LINE,
        });
        page.drawLine({
          start: { x: middle, y: prior.y },
          end: { x: middle, y: target.y },
          thickness: 1,
          color: LINE,
        });
        page.drawLine({
          start: { x: middle, y: target.y },
          end: { x: target.x, y: target.y },
          thickness: 1,
          color: LINE,
        });
      });
    }),
  );
  rounds.forEach((round) =>
    round.matches.forEach((match) => {
      const position = positions.get(match.id)!;
      drawMatch(
        page,
        font,
        level,
        board,
        match,
        position.x,
        position.y,
        cardWidth,
        cardHeight,
        large,
      );
    }),
  );
  plan.bronze.forEach((match, index) => {
    const x = startX + (count - 1) * (cardWidth + gap);
    drawMatch(
      page,
      font,
      level,
      board,
      match,
      x,
      bottom + cardHeight / 2 + index * (cardHeight + 10),
      cardWidth,
      cardHeight,
      large,
    );
  });
}

function drawFinalPage(
  page: PDFPage,
  font: FontPair,
  board: Board,
  level: Level,
  plan: BracketPage,
) {
  const { width, height } = page.getSize();
  const large = width > 900;
  const semis = bracketRounds(level).find((round) => round.size === 4)?.matches || [];
  const finals = plan.rounds.flatMap((round) => round.matches);
  const cardWidth = large ? 310 : 265;
  const cardHeight = large ? 80 : 62;
  const left = width / 2 - cardWidth - 55;
  const right = width / 2 + 55;
  const topY = height * 0.65;
  const bottomY = height * 0.34;
  semis.forEach((match, index) =>
    drawMatch(
      page,
      font,
      level,
      board,
      match,
      left,
      index ? bottomY : topY,
      cardWidth,
      cardHeight,
      large,
    ),
  );
  finals.forEach((match) => {
    const center = (topY + bottomY) / 2;
    drawMatch(page, font, level, board, match, right, center, cardWidth, cardHeight, large);
    semis.forEach((semi, index) => {
      if (!matchSources(level, match).some((source) => source.matchId === semi.id)) return;
      const y = index ? bottomY : topY;
      const middle = width / 2;
      page.drawLine({
        start: { x: left + cardWidth, y },
        end: { x: middle, y },
        thickness: 1,
        color: LINE,
      });
      page.drawLine({
        start: { x: middle, y },
        end: { x: middle, y: center },
        thickness: 1,
        color: LINE,
      });
      page.drawLine({
        start: { x: middle, y: center },
        end: { x: right, y: center },
        thickness: 1,
        color: LINE,
      });
    });
  });
  plan.bronze.forEach((match, index) =>
    drawMatch(
      page,
      font,
      level,
      board,
      match,
      right,
      height * 0.17 + index * (cardHeight + 10),
      cardWidth,
      cardHeight,
      large,
    ),
  );
}

export async function createBracketPdf({
  board,
  level,
  fontBytes,
  boldFontBytes,
  logoBytes,
}: {
  board: Board;
  level: Level;
  fontBytes: Uint8Array;
  boldFontBytes: Uint8Array;
  logoBytes: Uint8Array;
}) {
  const displayLevel: Level = {
    ...level,
    matches: level.matches.map((match) => ({ ...match, players: [...match.players] })),
  };
  propagatePlayers(displayLevel);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font: FontPair = {
    regular: await document.embedFont(fontBytes, { subset: true }),
    bold: await document.embedFont(boldFontBytes, { subset: true }),
  };
  const logo = await document.embedJpg(logoBytes);
  const plans = bracketPdfPages(displayLevel);
  const big =
    (bracketRounds(displayLevel).find((round) => round.size > 0)?.matches.length || 0) > 8 ||
    displayLevel.matches.some((match) => match.players.some((name) => name.length > 30));
  for (const [index, plan] of plans.entries()) {
    const page = document.addPage(big ? A3_LANDSCAPE : A4_LANDSCAPE);
    drawHeader(page, font, logo, board, displayLevel, plan.note || '', index + 1, plans.length);
    if (plans.length > 1 && index === plans.length - 1 && plan.rounds.length <= 1)
      drawFinalPage(page, font, board, displayLevel, plan);
    else drawRoundPage(page, font, board, displayLevel, plan);
  }
  document.setTitle(`Drabinka finałowa - ${level.name} - ${board.season || 'sezon'}`);
  document.setSubject('Tennis League');
  document.setCreator('RTL Finals');
  return document.save();
}
