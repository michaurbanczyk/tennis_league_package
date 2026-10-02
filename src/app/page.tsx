'use client';
import './finals-photo.css';
import './rtl-header.css';
import './social-links.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AccessCodeForm } from '@/components/tennis/access-code-form';
import { ScoreEditor } from '@/components/tennis/score-editor';
import { ArchiveDelete } from '@/components/tennis/archive-delete';
import { BackupPanel } from '@/components/tennis/backup-panel';
import { MatchSearch } from '@/components/tennis/match-search';
import { SeasonFields, readSeasonFields } from '@/components/tennis/season-fields';
import { leagueBrand, numberedSeason } from '@/lib/league-theme';
import { LeagueBrand } from '@/components/tennis/league-brand';
import { SITE_LEAGUE } from '@/lib/site-league';
import { BracketSetup } from '@/components/tennis/bracket-setup';
import { RefereeSettings } from '@/components/tennis/referee';
import { RefereeWhistleIcon } from '@/components/tennis/referee-whistle-icon';
import { TvView } from '@/components/tennis/tv-view';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SquarePen,
  Trophy,
  Undo2,
  WifiOff,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster, toast } from 'sonner';
import { Sponsors } from '@/components/tennis/sponsors';
import { SocialLinks, SocialLinkSettings } from '@/components/tennis/social-links';
import { HeroBannerSettings } from '@/components/tennis/hero-banner-settings';
import { resolveHeroBanner } from '@/lib/hero-banner';
import { localMatchDate } from '@/lib/match-timing';
import { FinalsSummary } from '@/components/tennis/finals-summary';
import { Announcements } from '@/components/tennis/announcements';
import {
  matchFormat,
  hasMatchSchedule,
  MATCH_SCHEDULE_REQUIRED,
  seedLimit,
  scopeMatchId,
  courtSchedule,
  liveCourts,
  polishDate,
  courtLabel,
  entryMatches,
  matchSources,
  propagatePlayers,
  isDoubles,
  demo,
  matchWinner,
  setWinner,
  LIVE_LIMIT_MS,
  type Board,
  type Match,
} from '@/lib/tennis';
import { ResultsView } from '@/components/tennis/results-view';
import { ScheduleView } from '@/components/tennis/schedule-view';
import { LiveView } from '@/components/tennis/live-view';
import { CourtSelect, MatchDateSelect } from '@/components/tennis/match-form-fields';
import type { LeagueData as Data, LeagueModal as Modal } from '@/lib/league-page-types';

const empty: Data = { levels: [], theme: SITE_LEAGUE, revision: 0, scope: null };

export default function Home() {
  const [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(true),
    [online, setOnline] = useState(true),
    [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedArchive, setSelectedArchive] = useState(''),
    [archiveData, setArchiveData] = useState<Board | null>(null),
    [archiveLoading, setArchiveLoading] = useState(false),
    [archiveError, setArchiveError] = useState('');
  const archived = !!selectedArchive;
  const [tvMode, setTvMode] = useState(false);
  const [resetRevision, setResetRevision] = useState<number | null>(null);
  const exitTv = useCallback(() => {
    setTvMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  function enterTv() {
    setTvMode(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen)
      void document.documentElement.requestFullscreen().catch(() => {});
  }
  const [finishedDate, setFinishedDate] = useState(localMatchDate(Date.now()));
  const [view, setView] = useState('results'),
    [finishedTime, setFinishedTime] = useState(''),
    [selectedDate, setSelectedDate] = useState(''),
    [courtFilter, setCourtFilter] = useState('all');
  const [filter, setFilter] = useState('all'),
    [modal, setModal] = useState<Modal>(null),
    [selected, setSelected] = useState<string | null>(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [codes, setCodes] = useState<Record<string, string>>({}),
    [demoEdit, setDemoEdit] = useState(false);
  const [demoBoard, setDemoBoard] = useState<Board>(() => structuredClone(demo));
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear())),
    [seasonNumber, setSeasonNumber] = useState('1');
  const [seasonText, setSeasonText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsExpanded = settingsOpen || !data.season || !data.finalsDates?.length;
  const [startSize, setStartSize] = useState(4);
  useEffect(() => {
    setSeasonText(data.season || '');
    if (data.season && numberedSeason.test(data.season)) {
      const [year, number] = data.season.split('/');
      setSeasonYear(year);
      setSeasonNumber(number);
    }
  }, [data.season]);
  const [format, setFormat] = useState('super');
  const [chosenLevel, setChosenLevel] = useState('');
  const ref = useRef(data),
    inFlight = useRef(false),
    upgradeAttempt = useRef<number | null>(null);
  const apply = useCallback((d: Data) => {
    if (d.revision >= ref.current.revision) {
      const next = { ...d, archives: d.archives ?? ref.current.archives };
      ref.current = next;
      setData(next);
    }
    setOnline(true);
    setLastSync(new Date());
  }, []);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/league', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      apply(d);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [apply]);
  useEffect(() => {
    void refresh();
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const connect = () => {
      if (stopped) return;
      const url = new URL('/api/league/live', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onopen = () => {
        retries = 0;
        // Catch any D1 writes committed before the socket was accepted.
        void refresh();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; revision?: number };
          if (message.type === 'changed' && Number(message.revision) > ref.current.revision)
            void refresh();
        } catch {
          // Ignore malformed realtime messages.
        }
      };
      socket.onclose = () => {
        socket = null;
        if (stopped) return;
        setOnline(false);
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 30000));
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const focus = () => void refresh();
    window.addEventListener('online', focus);
    window.addEventListener('focus', focus);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
      window.removeEventListener('online', focus);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  useEffect(() => {
    const nextExpiry = data.levels
      .flatMap((level) => level.matches)
      .filter((match) => match.status === 'live' && match.startedAt)
      .map((match) => Date.parse(match.startedAt!) + LIVE_LIMIT_MS)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    if (nextExpiry === undefined) return;
    const timer = setTimeout(() => void refresh(), Math.max(0, nextExpiry - Date.now() + 1000));
    return () => clearTimeout(timer);
  }, [data.levels, refresh]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'get_live_tennis_scores',
          title: 'Wyniki ligi tenisowej',
          description:
            'Read current real tournament scores and update the visible scoreboard. Demo data is excluded.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            if (!input || typeof input !== 'object' || Object.keys(input).length)
              throw Error('No parameters expected');
            const r = await fetch('/api/league', {
              cache: 'no-store',
              signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw Error('Scores unavailable');
            const d: any = await r.json();
            apply(d);
            return { levels: d.levels, revision: d.revision };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [apply]);
  useEffect(() => {
    if (!selectedArchive) {
      setArchiveData(null);
      setArchiveLoading(false);
      setArchiveError('');
      return;
    }
    const controller = new AbortController();
    setArchiveLoading(true);
    setArchiveData(null);
    setArchiveError('');
    fetch('/api/league?archive=' + encodeURIComponent(selectedArchive), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = (await r.json()) as Board & { error?: string };
        if (!r.ok) throw Error(d.error || 'Nie udało się pobrać archiwum.');
        return d;
      })
      .then((d) => {
        if (!controller.signal.aborted) setArchiveData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setArchiveError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setArchiveLoading(false);
      });
    return () => controller.abort();
  }, [selectedArchive]);
  function selectSeason(value: string) {
    if (value !== 'current' && view === 'live') setView('results');
    setSelectedArchive(value === 'current' ? '' : value);
    setArchiveData(null);
    setArchiveLoading(value !== 'current');
    setArchiveError('');
    setFilter('all');
    setSelectedDate('');
    setCourtFilter('all');
    setModal(null);
    setSelected(null);
  }
  const isDemo =
    SITE_LEAGUE !== 'relaksmisja' && !archived && !data.levels.length && data.revision === 0;
  const board = archived
    ? archiveData || {
        levels: [],
        season: data.archives?.find((a) => a.id === selectedArchive)?.season,
      }
    : isDemo
      ? demoBoard
      : data;
  const heroBanner = resolveHeroBanner(board);
  const levelNames = data.levels.map((l) => l.name);
  const isOrganizer = data.scope === 'admin',
    admin = isOrganizer && !archived,
    displayLoading = loading || archiveLoading;
  const theme = SITE_LEAGUE,
    brand = leagueBrand(theme),
    isRtl = theme === 'relaksmisja';
  const resultLevels = board.levels.filter(
    (l) =>
      admin ||
      !isRtl ||
      l.bracketConfigured ||
      entryMatches(l).some((m) => m.players.some((p) => p.trim())),
  );
  const resultMatchCount = resultLevels.reduce((count, l) => count + l.matches.length, 0);
  const activeLevelFilter = resultLevels.some((l) => l.id === filter) ? filter : 'all';
  const customSeason = isRtl || (!!data.season && !numberedSeason.test(data.season));
  useEffect(() => {
    if (displayLoading) return;
    document.body.dataset.league = theme;
    document.title = brand.title + ' · wyniki na żywo';
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="shortcut icon"]')
      .forEach((icon) => {
        icon.href = brand.logo;
      });
  }, [theme, brand.title, brand.logo, displayLoading]);
  const currentSeason =
    data.season && numberedSeason.test(data.season) ? data.season : `${new Date().getFullYear()}/1`;
  const [currentYear, currentNumber] = currentSeason.split('/').map(Number);
  const suggestedYear = currentNumber === 3 ? currentYear + 1 : currentYear,
    suggestedNumber = currentNumber === 3 ? '1' : String(currentNumber + 1);

  const level = board.levels.find((l) => l.matches.some((m) => m.id === selected));
  const match = level?.matches.find((m) => m.id === selected);
  const all = board.levels.flatMap((l) => l.matches);
  function open(type: Modal, id?: string) {
    if (type === 'reset-league') setResetRevision(ref.current.revision);
    if (type === 'create') {
      const target =
        data.levels.find((l) => l.id === id) ||
        data.levels.find((l) => !l.matches[0].players.some(Boolean));
      setChosenLevel(target?.name || levelNames[0] || '');
      setStartSize(target?.startSize || 4);
      setFormat('super');
    }
    setSelected(id ?? null);
    setCode('');
    setError('');
    setModal(type);
    setDemoEdit(false);
  }
  async function post(action: string, extra: Record<string, unknown> = {}) {
    if (archived && !['login', 'logout', 'delete_archive'].includes(action)) return null;
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/league' + (action === 'restore_backup' ? '?restore=1' : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, revision: ref.current.revision, ...extra }),
      });
      const d: any = await r.json();
      if (!r.ok) {
        if (r.status === 409) await refresh();
        throw Error(d.error || 'Nie udało się zapisać zmiany.');
      }
      if (d.levels) apply(d);
      else await refresh();
      return d;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Brak połączenia. Spróbuj ponownie.';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const needsCodeUpgrade = admin && all.some((m) => m.needsCodeUpgrade);
  async function upgradeCodes() {
    const d = await post('upgrade_codes');
    if (d?.codes && Object.keys(d.codes).length) {
      setCodes(d.codes);
      setModal('codes');
      toast.success('Dotychczasowe kody zamieniono na 5 cyfr. Zapisz nowe kody.');
    }
  }
  useEffect(() => {
    if (!needsCodeUpgrade || busy || modal !== null || upgradeAttempt.current === data.revision)
      return;
    upgradeAttempt.current = data.revision;
    void upgradeCodes();
  }, [needsCodeUpgrade, busy, modal, data.revision]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    const d = await post('login', {
      code,
      ...(modal === 'referee-login' ? { role: 'referee' } : {}),
    });
    if (d) {
      if (d.scope === 'admin') {
        setModal(null);
        toast.success('Panel organizatora jest odblokowany.');
      } else {
        setSelected(scopeMatchId(d.scope));
        setModal('editor');
        setError('');
      }
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = data.levels.find((l) => l.name === chosenLevel);
    const f = new FormData(e.currentTarget);
    const rounds = [
      ...[32, 16, 8, 4, 2].filter((n) => n <= startSize),
      ...(startSize > 2 ? [0] : []),
    ];
    const roundFormats = Object.fromEntries(
      rounds.map((n) => [String(n), f.get('roundFormat-' + n) || format]),
    );
    const d = await post('create_bracket', {
      levelId: target?.id,
      startSize,
      format,
      roundFormats,
    });
    if (d) {
      setModal(null);
      setFilter(target?.id || 'all');
      setView('results');
      toast.success('Drabinka gotowa. Kliknij „Edytuj mecz”, aby ją uzupełnić.');
    }
  }
  async function score(action: string, player?: number) {
    if (!match) return;
    if (demoEdit) {
      const b = structuredClone(demoBoard);
      const l = b.levels.find((l) => l.id === level?.id)!;
      const m = l.matches.find((m) => m.id === match.id)!;
      try {
        const { addScore, startMatch, undoScore } = await import('@/lib/tennis');
        if (action === 'start') startMatch(m);
        if (action === 'add') addScore(m, player!, l.format);
        if (action === 'undo') undoScore(m);
        if (action === 'finish') {
          m.history ??= [];
          m.history.push({
            sets: structuredClone(m.sets),
            status: m.status,
            winner: m.winner,
            finishedTime: m.finishedTime ?? null,
          });
          m.status = 'finished';
          m.winner = matchWinner(m.sets, l.format);
          m.finishedTime = finishedTime;
        }
        propagatePlayers(l);
        setDemoBoard(b);
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (!hasMatchSchedule(match, board)) {
      setError(MATCH_SCHEDULE_REQUIRED);
      return;
    }
    await post(action, {
      matchId: match.id,
      matchRevision: match.matchRevision ?? 0,
      player,
      ...(action === 'finish' ? { finishedTime, finishedDate } : {}),
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Skopiowano.');
    } catch {
      toast.error('Nie udało się skopiować. Zaznacz i skopiuj tekst ręcznie.');
    }
  }
  function edit(m: Match) {
    if (!isDemo && !hasMatchSchedule(m, board)) {
      toast.error(MATCH_SCHEDULE_REQUIRED);
      return;
    }
    if (isDemo) {
      open('editor', m.id);
      setDemoEdit(true);
    } else if (admin || scopeMatchId(data.scope) === m.id) open('editor', m.id);
    else open('login', m.id);
  }
  const scoringFormat = level && match ? matchFormat(level, match) : 'super';
  const current = match?.sets[match.sets.length - 1];
  const nextThird =
    match &&
    match.sets.length === 2 &&
    setWinner(current!) !== null &&
    matchWinner(match.sets, scoringFormat) === null;
  const superTB = scoringFormat === 'super' && (match?.sets.length === 3 || nextThird);
  const tieBreak = !superTB && current?.[0] === 6 && current?.[1] === 6;
  const ready = match && matchWinner(match.sets, scoringFormat) !== null;
  useEffect(() => {
    if (modal === 'editor' && ready && match?.status !== 'finished') {
      setFinishedDate(localMatchDate(Date.now()));
      setFinishedTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Warsaw',
        }),
      );
    }
  }, [modal, match?.id, ready, match?.status]);
  const schedule = courtSchedule(board);
  const today = polishDate(lastSync || new Date()),
    liveCourtList = liveCourts(board, today);
  const hasLive = liveCourtList.some((c) => c.live.length > 0),
    hasWaiting = liveCourtList.some((c) => c.waiting.length > 0);
  const activeDate = schedule.some((d) => d.date === selectedDate)
    ? selectedDate
    : schedule[0]?.date || '';
  const newSet =
    match &&
    !ready &&
    setWinner(current!, scoringFormat === 'super' && match.sets.length === 3) !== null;
  const cardProps = {
    archived,
    admin,
    isDemo,
    scope: data.scope,
    edit,
    open,
    board,
    serverTime: data.serverTime,
  };

  if (tvMode && !archived)
    return (
      <TvView
        board={board}
        today={today}
        online={online}
        lastSync={lastSync}
        serverTime={data.serverTime}
        isDemo={isDemo}
        onExit={exitTv}
      />
    );
  return (
    <>
      <Toaster position="top-center" richColors />
      <header className="site-header">
        <div className={isRtl ? 'rtl-header-hero' : undefined}>
          <div className="header-access-wrap">
            <div className="footer-access">
              {!archived && (
                <button
                  className="footer-referee"
                  onClick={() =>
                    data.scope && data.scope !== 'admin'
                      ? open('editor', scopeMatchId(data.scope)!)
                      : open('login')
                  }
                >
                  <SquarePen size={17} aria-hidden="true" />
                  <span>{data.scope && data.scope !== 'admin' ? 'Mój mecz' : 'Wpisz wynik'}</span>
                </button>
              )}
              <button
                className="footer-organizer"
                onClick={() => (isOrganizer ? post('logout') : open('admin'))}
              >
                <Settings2 size={17} aria-hidden="true" />
                <span>{isOrganizer ? 'Wyloguj organizatora' : 'Organizator'}</span>
              </button>
              {isRtl &&
                !archived &&
                data.levels.some((l) => l.matches.some((m) => m.refereeEnabled)) && (
                  <button className="footer-referee" onClick={() => open('referee-login')}>
                    <RefereeWhistleIcon />
                    Sędzia
                  </button>
                )}
            </div>
            {isRtl && <SocialLinks />}
          </div>
          <div className="header-inner">
            <a className="brand" href="/" aria-label={brand.name + ' — strona główna'}>
              <LeagueBrand theme={theme} />
            </a>
          </div>
        </div>
        <MatchSearch
          key={selectedArchive || data.season || 'current'}
          board={board}
          loading={displayLoading}
          archived={archived}
          isDemo={isDemo}
          error={archiveError}
          navigation={(closeMenu) => (
            <Tabs
              value={view}
              onValueChange={(next) => {
                setView(next);
                closeMenu();
              }}
              className="brand-navigation page-tabs"
            >
              <TabsList aria-label="Widok strony">
                <TabsTrigger value="results">DRABINKI</TabsTrigger>
                <TabsTrigger value="schedule">PLAN GIER</TabsTrigger>
                <TabsTrigger value="live" disabled={archived}>
                  WYNIKI NA ŻYWO
                </TabsTrigger>
                <TabsTrigger value="summary">STATYSTYKI</TabsTrigger>
                <TabsTrigger value="announcements">KOMUNIKATY</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />
      </header>
      {isRtl && (
        <section className="finals-photo-heading" aria-labelledby="finals-photo-title">
          <div className="finals-photo-inner">
            <h1 id="finals-photo-title">
              {heroBanner.kicker && (
                <span
                  className="finals-photo-kicker"
                  style={{ fontSize: `min(${heroBanner.kickerSize}px, 5.5vw)` }}
                >
                  {heroBanner.kicker}
                </span>
              )}
              {heroBanner.name && (
                <span
                  className="finals-photo-name"
                  style={{ fontSize: `min(${heroBanner.nameSize}px, 7vw)` }}
                >
                  {heroBanner.name}
                </span>
              )}
              {heroBanner.season && (
                <span
                  className="finals-photo-season"
                  style={{ fontSize: `min(${heroBanner.seasonSize}px, 5.5vw)` }}
                >
                  {heroBanner.season}
                </span>
              )}
            </h1>
          </div>
        </section>
      )}
      {!isRtl && (
        <div className="tennis-banner" role="img" aria-label="Rakieta tenisowa — Smart Liga" />
      )}
      <main className={`main-wrap${isRtl ? ' finals-main' : ''}`}>
        {!isRtl && (
          <section className="heading">
            {!isRtl && (
              <div>
                <div className="heading-title">
                  <span className="heading-symbol">
                    <Trophy size={26} />
                  </span>
                  <div>
                    <h1>
                      {brand.title}
                      {board.season && (
                        <span className="season-heading">
                          {isRtl ? '' : 'Sezon '}
                          {board.season}
                        </span>
                      )}
                    </h1>
                    {!isRtl && <p>Półfinały · finały · mecze o 3. miejsce</p>}
                  </div>
                </div>
              </div>
            )}
            <div className={`sync ${online ? '' : 'offline'}`} role="status">
              {!archived && (online ? <span className="live-dot" /> : <WifiOff size={16} />)}
              <div>
                <strong>
                  {archived
                    ? 'Archiwum sezonu'
                    : loading
                      ? 'Łączenie…'
                      : online
                        ? 'Automatyczne odświeżanie'
                        : 'Brak połączenia'}
                </strong>
                <span>
                  {archived
                    ? 'Wyniki do przeglądania'
                    : loading
                      ? 'Pobieramy wyniki'
                      : online
                        ? 'Co 3 sekundy'
                        : lastSync
                          ? 'Wyświetlamy ostatnio pobrane wyniki'
                          : 'Próbujemy połączyć się ponownie'}
                </span>
              </div>
            </div>
          </section>
        )}
        {isRtl && !archived && !loading && !online && (
          <p className="finals-connection-warning" role="status">
            <WifiOff size={16} aria-hidden="true" /> Brak połączenia — wyświetlamy ostatnio pobrane
            wyniki.
          </p>
        )}
        {data.archives?.length || archived ? (
          <div className="season-picker">
            <span id="season-picker-label">Sezon</span>
            <Select value={selectedArchive || 'current'} onValueChange={selectSeason}>
              <SelectTrigger className="format-select" aria-labelledby="season-picker-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">{data.season || 'Bieżący sezon'} · bieżący</SelectItem>
                {data.archives?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.season} · archiwum
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {archived && (
              <button className="text-button" onClick={() => selectSeason('current')}>
                Wróć do bieżącego sezonu
              </button>
            )}
            {archived && isOrganizer && data.archives?.find((a) => a.id === selectedArchive) && (
              <ArchiveDelete
                key={selectedArchive}
                archive={data.archives.find((a) => a.id === selectedArchive)!}
                revision={data.revision}
                busy={busy}
                onDelete={async (extra) => {
                  const d = await post('delete_archive', extra);
                  if (!d) return false;
                  selectSeason('current');
                  toast.success('Usunięto sezon z archiwum.');
                  return true;
                }}
              />
            )}
          </div>
        ) : null}
        {archiveError && (
          <p className="error-message" role="alert">
            {archiveError}
          </p>
        )}
        {admin && (
          <div className="organizer-panel">
            <div className="admin-bar">
              <span>
                <ShieldCheck size={18} />
                <strong>Panel organizatora</strong>
                <span className="hide-mobile">Utwórz drabinkę i uzupełniaj mecze.</span>
              </span>
              <div className="organizer-actions">
                <button
                  className="button dark"
                  onClick={() => {
                    setFormat('super');
                    open('create');
                  }}
                >
                  <Plus size={17} /> Ustaw drabinkę
                </button>
              </div>
            </div>
            <Collapsible
              open={settingsExpanded}
              onOpenChange={setSettingsOpen}
              className="finals-settings"
            >
              <div className="finals-settings-heading">
                <strong>Ustawienia finałów</strong>
                {data.season && !!data.finalsDates?.length && (
                  <CollapsibleTrigger className="button outline" disabled={busy}>
                    {settingsExpanded ? 'Zwiń' : 'Edytuj'}
                  </CollapsibleTrigger>
                )}
              </div>
              <CollapsibleContent>
                <form
                  className="season-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      await post('season', {
                        season: isRtl
                          ? data.season || heroBanner.season
                          : customSeason
                            ? seasonText
                            : seasonYear + '/' + seasonNumber,
                        ...readSeasonFields(f),
                      })
                    ) {
                      setSettingsOpen(false);
                      toast.success('Zapisano ustawienia finałów.');
                    }
                  }}
                >
                  {isRtl ? (
                    !data.season && (
                      <p className="settings-date-note">
                        Najpierw wpisz nazwę sezonu w dolnym wierszu sekcji „Tekst na banerze”.
                      </p>
                    )
                  ) : customSeason ? (
                    <label className="season-name-field">
                      Nazwa sezonu
                      <input
                        value={seasonText}
                        onChange={(e) => setSeasonText(e.target.value)}
                        placeholder="np. Lato 2026"
                        maxLength={60}
                        required
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Rok
                        <input
                          type="number"
                          min="2000"
                          max="2199"
                          step="1"
                          value={seasonYear}
                          onChange={(e) => setSeasonYear(e.target.value)}
                          required
                        />
                      </label>
                      <div>
                        <label className="field-label">Sezon</label>
                        <Select value={seasonNumber} onValueChange={setSeasonNumber}>
                          <SelectTrigger aria-label="Sezon" className="format-select">
                            <SelectValue>{seasonNumber}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {['1', '2', '3'].map((n) => (
                              <SelectItem key={n} value={n}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <SeasonFields
                    key={JSON.stringify([data.finalsDates, data.courtGroups])}
                    board={data}
                    busy={busy}
                  />
                  <button className="button dark" disabled={busy || (isRtl && !data.season)}>
                    <Check size={17} /> Zapisz ustawienia finałów
                  </button>
                </form>
                <p className="settings-date-note">Te ustawienia dotyczą bieżących finałów.</p>
              </CollapsibleContent>
            </Collapsible>
            {isRtl && (
              <HeroBannerSettings
                board={data}
                busy={busy}
                onSave={async (banner) => {
                  const saved = await post('hero_banner', { heroBanner: banner });
                  if (saved) toast.success('Zapisano tekst banera.');
                  return Boolean(saved);
                }}
              />
            )}
            <SocialLinkSettings />
            <Collapsible className="season-management">
              <CollapsibleTrigger className="season-management-trigger">
                <span>Zarządzanie sezonami</span>
                <ChevronRight size={18} aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="season-management-content">
                <p>Po zakończeniu finałów zapisz je w archiwum i przygotuj kolejną edycję.</p>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() => open('new-season')}
                >
                  <Plus size={17} /> Rozpocznij nowy sezon
                </button>
                <div className="reset-league-section">
                  <button
                    className="button outline reset-trigger"
                    disabled={busy}
                    onClick={() => open('reset-league')}
                  >
                    <Undo2 size={17} /> Zeruj ustawienia bieżącej ligi
                  </button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <BackupPanel
              revision={data.revision}
              disabled={busy}
              onRestore={async (backup, revision) => {
                const d = await post('restore_backup', { backup, revision, confirm: true });
                if (!d) return false;
                setSelected(null);
                setCodes({});
                setFilter('all');
                setSelectedDate('');
                setCourtFilter('all');
                setView('results');
                toast.success('Przywrócono kopię zapasową.');
                return true;
              }}
            />
          </div>
        )}
        {needsCodeUpgrade && (
          <div className="code-upgrade-notice">
            <span>
              Dotychczasowe kody zostaną zastąpione kodami 5-cyfrowymi. Zapisz nową listę dla
              zawodników.
            </span>
            <button className="button outline" disabled={busy} onClick={upgradeCodes}>
              Pokaż nowe kody
            </button>
          </div>
        )}
        {!loading && isDemo && (
          <div className="demo-notice">
            <div>
              <span className="demo-tag">DEMO</span>
              <span>Poniżej przykładowe mecze. Organizator nie opublikował jeszcze par.</span>
            </div>
            {admin && (
              <button onClick={() => open('create')}>
                Ustaw finały <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        )}
        <ResultsView
          view={view}
          board={board}
          displayLoading={displayLoading}
          cardProps={cardProps}
          isDemo={isDemo}
          archiveId={selectedArchive}
          resultMatchCount={resultMatchCount}
          copy={copy}
          activeLevelFilter={activeLevelFilter}
          setFilter={setFilter}
          resultLevels={resultLevels}
          admin={admin}
          open={open}
        />
        {view === 'summary' &&
          (displayLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <FinalsSummary board={board} />
          ))}
        {view === 'announcements' && <Announcements admin={isOrganizer} />}
        <ScheduleView
          view={view}
          board={board}
          displayLoading={displayLoading}
          cardProps={cardProps}
          schedule={schedule}
          activeDate={activeDate}
          setSelectedDate={setSelectedDate}
          courtFilter={courtFilter}
          setCourtFilter={setCourtFilter}
          loading={loading}
          all={all}
        />
        <LiveView
          view={view}
          board={board}
          displayLoading={displayLoading}
          cardProps={cardProps}
          archived={archived}
          enterTv={enterTv}
          hasLive={hasLive}
          hasWaiting={hasWaiting}
          today={today}
          setSelectedDate={setSelectedDate}
          setView={setView}
          liveCourtList={liveCourtList}
        />
        {!archived && (
          <section className="courtside">
            <div className="courtside-icon">
              <SquarePen size={24} aria-hidden="true" />
            </div>
            <div>
              <h3>Jesteś na korcie?</h3>
              <p>Wpisz kod od organizatora, rozpocznij mecz i aktualizuj wynik po każdym gemie.</p>
            </div>
            <button className="button outline" onClick={() => open('login')}>
              Mam kod do meczu <ChevronRight size={17} />
            </button>
          </section>
        )}
        <footer className="site-footer">
          <span className={`footer-brand${isRtl ? ' footer-brand-powered' : ''}`}>
            {brand.name} <span className="footer-divider">/</span>{' '}
            {isRtl ? (
              <span className="footer-powered">
                powered by:
                <a
                  href="https://appscore.pl"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="AppScore — otwórz stronę"
                >
                  <img src="/appscore-logo.png" alt="AppScore" width={170} height={40} />
                </a>
              </span>
            ) : (
              'wyniki na żywo'
            )}
          </span>
          <div className="footer-tools">
            <span>
              {archived
                ? 'Archiwum · tylko podgląd'
                : lastSync
                  ? `Ostatnie połączenie: ${lastSync.toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw' })}`
                  : 'Oczekiwanie na połączenie'}
            </span>
          </div>
        </footer>
        <Sponsors />
      </main>
      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setModal(null);
            setCode('');
            setError('');
          }
        }}
      >
        <DialogContent className={`app-dialog ${modal === 'create' ? 'wide-dialog' : ''}`}>
          <DialogTitle>
            {modal === 'reset-league'
              ? 'Czy na pewno chcesz wyzerować ustawienia bieżącej ligi?'
              : modal === 'new-season'
                ? 'Rozpocznij nowy sezon'
                : modal === 'referee-login'
                  ? 'Wpisz kod sędziego'
                  : modal === 'login'
                    ? 'Twój mecz. Twój wynik.'
                    : modal === 'admin'
                      ? 'Panel organizatora'
                      : modal === 'create'
                        ? 'Ustaw fazę pucharową'
                        : modal === 'codes'
                          ? 'Kody do meczów'
                          : modal === 'details'
                            ? 'Ustawienia meczu'
                            : demoEdit
                              ? 'Wypróbuj tablicę wyników'
                              : match?.stage || 'Wpisywanie wyniku'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'reset-league'
              ? `Potwierdzasz wyzerowanie bieżących rozgrywek ${brand.name}${data.season ? ' · ' + data.season : ''}.`
              : modal === 'new-season'
                ? `Bieżące finały ${data.season || ''} zostaną zapisane w archiwum. Nowy sezon rozpocznie się z pustymi parami na ${levelNames.length} poziomach.`
                : modal === 'referee-login'
                  ? 'Wpisz osobny 5-cyfrowy kod sędziego otrzymany od organizatora.'
                  : modal === 'login'
                    ? 'Wpisz 5-cyfrowy kod otrzymany od organizatora.'
                    : modal === 'admin'
                      ? 'Wpisz prywatny kod organizatora, aby zarządzać finałami.'
                      : modal === 'create'
                        ? 'Wybierz poziom i liczbę rund. Zawodników oraz terminy uzupełnisz bezpośrednio w drabince.'
                        : modal === 'codes'
                          ? 'Przekaż każdy kod osobom wpisującym wynik danego meczu. Jako organizator znajdziesz go także w ustawieniach meczu.'
                          : modal === 'details'
                            ? `${level?.name} · ${match?.stage}`
                            : demoEdit
                              ? 'To przykładowy mecz. Zmiany widzisz tylko Ty.'
                              : `${level?.name || ''} · ${match ? courtLabel(match.court, board) : 'Mecz'}`}
          </DialogDescription>
          {modal === 'reset-league' && admin && (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const adminPassword = code;
                setCode('');
                const d = await post('reset_league', {
                  confirm: true,
                  adminPassword,
                  revision: resetRevision,
                });
                if (d) {
                  setModal(null);
                  setSelected(null);
                  setCodes({});
                  setFilter('all');
                  setSelectedDate('');
                  setCourtFilter('all');
                  setSeasonText('');
                  setSeasonYear(String(new Date().getFullYear()));
                  setSeasonNumber('1');
                  setView('results');
                  toast.success('Wyzerowano ustawienia bieżącej ligi.');
                }
              }}
            >
              <p className="reset-league-warning">
                Usuniesz ustawienia bieżącego sezonu, wszystkie pary, wyniki, terminy, transmisje i
                kody do meczów oraz sędziowania. Nie powstanie kopia zapasowa ani nowy wpis w
                archiwum. Tej operacji nie można cofnąć.
              </p>
              <p className="reset-league-note">
                Dotychczasowe archiwum pozostanie zachowane. Zawodnicy i sędziowie zostaną
                wylogowani.
              </p>
              <label>
                Wpisz ponownie hasło administratora
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="current-password"
                  required
                  maxLength={64}
                  disabled={busy}
                />
              </label>
              <button className="button reset-danger full" disabled={busy || code.length < 5}>
                {busy ? <Loader2 size={18} className="spin" /> : <Undo2 size={18} />} Tak, wyzeruj
                ustawienia bieżącej ligi
              </button>
              <button
                type="button"
                className="button outline full"
                disabled={busy}
                onClick={() => {
                  setModal(null);
                  setCode('');
                  setError('');
                }}
              >
                Anuluj
              </button>
            </form>
          )}
          {modal === 'new-season' && (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const d = await post('new_season', {
                  season: customSeason ? f.get('season') : f.get('year') + '/' + f.get('number'),
                  ...readSeasonFields(f),
                });
                if (d) {
                  setModal(null);
                  setSelected(null);
                  setCodes({});
                  setFilter('all');
                  setSelectedDate('');
                  setCourtFilter('all');
                  setView('results');
                  toast.success('Nowy sezon jest gotowy. Poprzednie finały znajdziesz w archiwum.');
                }
              }}
            >
              {customSeason ? (
                <label>
                  Nazwa nowego sezonu
                  <input
                    name="season"
                    placeholder="np. Zima 2026"
                    maxLength={60}
                    required
                    disabled={busy}
                  />
                </label>
              ) : (
                <div className="form-grid">
                  <label>
                    Rok
                    <input
                      type="number"
                      name="year"
                      min="2000"
                      max="2199"
                      step="1"
                      defaultValue={suggestedYear}
                      required
                      disabled={busy}
                    />
                  </label>
                  <div>
                    <label className="field-label">Sezon</label>
                    <Select name="number" defaultValue={suggestedNumber} required disabled={busy}>
                      <SelectTrigger className="format-select" aria-label="Numer nowego sezonu">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3'].map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <SeasonFields board={data} busy={busy} newSeason />
              <p className="new-season-note">
                Pary, wyniki i terminy bieżących finałów pozostaną w archiwum do przeglądania.
                Dotychczasowe kody przestaną działać. Nowe kody otrzymasz po ustawieniu nowych par.
              </p>
              <button className="button dark full" disabled={busy}>
                {busy ? <Loader2 size={18} className="spin" /> : <Plus size={18} />} Zapisz archiwum
                i rozpocznij sezon
              </button>
              <button
                type="button"
                className="button outline full"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Anuluj
              </button>
            </form>
          )}
          {(modal === 'login' || modal === 'referee-login' || modal === 'admin') && (
            <AccessCodeForm
              role={modal}
              code={code}
              onCodeChange={setCode}
              onSubmit={login}
              busy={busy}
            />
          )}
          {modal === 'create' && (
            <BracketSetup
              board={data}
              names={levelNames}
              name={chosenLevel}
              onName={setChosenLevel}
              size={startSize}
              onSize={setStartSize}
              format={format}
              onFormat={setFormat}
              busy={busy}
              revision={data.revision}
              onManage={async (action, extra) => {
                const d = await post(action, extra);
                if (!d) return false;
                setCodes({});
                setFilter('all');
                if (action === 'delete_level') setChosenLevel(d.levels[0]?.name || '');
                else setChosenLevel(String(extra.name));
                toast.success(
                  action === 'delete_level'
                    ? 'Usunięto poziom.'
                    : action === 'add_level'
                      ? 'Dodano poziom.'
                      : 'Zmieniono nazwę poziomu.',
                );
                return true;
              }}
              onSubmit={create}
            />
          )}
          {modal === 'codes' && (
            <div className="stack-form">
              {Object.entries(codes).map(([id, c]) => {
                const l = data.levels.find((l) => l.matches.some((m) => m.id === id));
                const m = l?.matches.find((m) => m.id === id);
                return (
                  <div className="code-card" key={id}>
                    <span>
                      {l?.name} · {m?.stage}
                    </span>
                    <strong>
                      {m?.players.filter(Boolean).join(' — ') || 'Oczekuje na finalistów'}
                    </strong>
                    <span>Kod zawodnika{m?.refereeEnabled ? ' · tylko podgląd' : ''}</span>
                    <div>
                      <code>{c}</code>
                      <button
                        className="icon-button"
                        aria-label={'Kopiuj kod ' + m?.stage}
                        onClick={() =>
                          copy(
                            `${window.location.origin}\n${l?.name} · ${m?.stage}\nKod meczu: ${c}`,
                          )
                        }
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                    {m?.refereeCurrentCode && (
                      <>
                        <span className="referee-code-caption">Kod sędziego · punkty w gemach</span>
                        <div className="referee-code">
                          <code>{m.refereeCurrentCode}</code>
                          <button
                            className="icon-button"
                            aria-label={'Kopiuj kod sędziego ' + m.stage}
                            onClick={() =>
                              copy(
                                `${window.location.origin}\n${l?.name} · ${m.stage}\nKod sędziego: ${m.refereeCurrentCode}`,
                              )
                            }
                          >
                            <Copy size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <button
                className="button dark full"
                onClick={() => {
                  setCodes({});
                  setModal(null);
                }}
              >
                Kody zapisane — gotowe <Check size={18} />
              </button>
            </div>
          )}
          <ScoreEditor
            modal={modal}
            match={match}
            level={level}
            scope={data.scope}
            demoEdit={demoEdit}
            board={board}
            cardProps={cardProps}
            open={open}
            admin={admin}
            scoringFormat={scoringFormat}
            current={current}
            superTB={superTB}
            tieBreak={tieBreak}
            ready={ready}
            newSet={newSet}
            busy={busy}
            online={online}
            score={score}
            finishedDate={finishedDate}
            setFinishedDate={setFinishedDate}
            finishedTime={finishedTime}
            setFinishedTime={setFinishedTime}
            post={post}
            setModal={setModal}
          />
          {modal === 'details' && match && (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await post('details', {
                    matchId: match.id,
                    players: [f.get('p0'), f.get('p1')],
                    ...(level && !matchSources(level, match).length
                      ? {
                          seeds: [0, 1].map((i) => {
                            const value = f.get('seed' + i);
                            return !value || value === 'none' ? null : Number(value);
                          }),
                        }
                      : {}),
                    court: f.get('court') === 'unassigned' ? '' : f.get('court'),
                    date: f.get('date') === 'unassigned' ? '' : f.get('date'),
                    time: f.get('time'),
                    youtubeUrl: f.get('youtubeUrl'),
                  })
                ) {
                  setModal(null);
                  toast.success('Zapisano dane meczu.');
                }
              }}
            >
              {level &&
                !matchSources(level, match).length &&
                match.players.map((p, i) => (
                  <div className="seed-player-fields" key={i}>
                    <label>
                      {isDoubles(level) ? 'Para' : 'Zawodnik'} {i + 1}
                      <input
                        name={'p' + i}
                        defaultValue={p}
                        maxLength={isDoubles(level) ? 150 : 70}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Rozstawienie (opcjonalne)
                      <Select
                        name={'seed' + i}
                        defaultValue={String(match.seeds?.[i] ?? 'none')}
                        disabled={busy}
                      >
                        <SelectTrigger
                          className="format-select"
                          aria-label={`Rozstawienie ${isDoubles(level) ? 'pary' : 'zawodnika'} ${i + 1}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez rozstawienia</SelectItem>
                          {Array.from({ length: seedLimit(level) }, (_, n) => (
                            <SelectItem key={n + 1} value={String(n + 1)}>
                              {n + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                ))}
              <div className="form-grid">
                <label>
                  Numer kortu
                  <CourtSelect board={data} name="court" value={match.court} disabled={busy} />
                </label>
                <label>
                  Data
                  <MatchDateSelect
                    name="date"
                    dates={data.finalsDates || []}
                    value={match.date}
                    disabled={busy}
                  />
                </label>
                <label>
                  Godzina
                  <input type="time" name="time" defaultValue={match.time} disabled={busy} />
                </label>
              </div>
              <label>
                Link do transmisji YouTube (opcjonalnie)
                <input
                  type="url"
                  name="youtubeUrl"
                  defaultValue={match.youtubeUrl || ''}
                  placeholder="https://www.youtube.com/live/…"
                  maxLength={2048}
                  disabled={busy}
                  aria-describedby="youtube-link-hint"
                />
              </label>
              <p id="youtube-link-hint" className="youtube-field-hint">
                Puste pole oznacza brak ikonki transmisji przy meczu.
              </p>
              <button className="button dark full" disabled={busy}>
                Zapisz dane
              </button>
              <p className="form-note">
                {level && !matchSources(level, match).length
                  ? 'Korekta nazwisk pojawi się także w kolejnych rundach. Wyniki pozostaną zachowane.'
                  : 'Nazwiska poprawisz w ustawieniach meczu pierwszej rundy. Wyniki pozostaną zachowane.'}
              </p>
              <div className="current-code-section">
                <strong>Obecny kod meczu</strong>
                {match.currentCode ? (
                  <div className="current-code-value">
                    <code>{match.currentCode}</code>
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => copy(match.currentCode!)}
                    >
                      <Copy size={16} /> Kopiuj kod
                    </button>
                  </div>
                ) : (
                  <p>
                    Kod zostanie wygenerowany po zapisaniu meczu. Możesz też wygenerować go
                    przyciskiem poniżej.
                  </p>
                )}
              </div>
              <RefereeSettings
                match={match}
                busy={busy}
                copy={copy}
                onChange={async (enabled, rotate) => {
                  if (await post('referee', { matchId: match.id, enabled, rotate }))
                    toast.success(enabled ? 'Kod sędziego jest gotowy.' : 'Sędziowanie wyłączone.');
                }}
              />
              <div className="rotate-section">
                <strong>Potrzebujesz nowego kodu?</strong>
                <p>Poprzedni kod przestanie działać, a osoby edytujące mecz zostaną wylogowane.</p>
                <button
                  type="button"
                  className="button outline full"
                  disabled={busy}
                  onClick={async () => {
                    const d = await post('rotate', { matchId: match.id });
                    if (d) {
                      setCodes(d.codes);
                      setModal('codes');
                    }
                  }}
                >
                  <RefreshCw size={16} /> Wygeneruj nowy kod meczu
                </button>
              </div>
            </form>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
