'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Download, Upload, Loader2, ShieldCheck } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SITE_LEAGUE, LEAGUE_FEATURES } from '@/lib/site-league';

type BackupPreview = {
  format: string;
  version: number;
  league: string;
  createdAt: string;
  records: { id: string; data: { season?: string; levels: unknown[] } }[];
};
export function BackupPanel({
  revision,
  disabled,
  onRestore,
}: {
  revision: number;
  disabled: boolean;
  onRestore: (backup: unknown, revision: number) => Promise<boolean>;
}) {
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [recovery, setRecovery] = useState(false);
  const [pending, setPending] = useState<{
      backup: BackupPreview;
      revision: number;
      filename: string;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    busy = disabled || working;
  useEffect(() => {
    let active = true;
    fetch('/api/league?backup=info', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (active) setRecovery(!!d?.recoveryAvailable);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function download(previous = false) {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/league?backup=' + (previous ? 'recovery' : 'download'), {
        cache: 'no-store',
      });
      if (!response.ok) {
        const d: any = await response.json();
        throw Error(d.error || 'Nie udało się pobrać kopii.');
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download =
        response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ||
        `${SITE_LEAGUE}-kopia.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage('Kopia jest gotowa do pobrania. Zachowaj plik w bezpiecznym miejscu.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać kopii. Spróbuj ponownie.');
    } finally {
      setWorking(false);
    }
  }
  async function choose(file: File) {
    setError('');
    setMessage('');
    setWorking(true);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error('Plik jest za duży. Maksymalny rozmiar kopii to 10 MB.');
      const backup = JSON.parse(await file.text()) as BackupPreview;
      if (
        backup?.format !== 'tennis-league-backup' ||
        (backup.version !== 1 &&
          !(
            LEAGUE_FEATURES.bracketEditor &&
            (backup.version === 2 || backup.version === 3 || backup.version === 4)
          )) ||
        backup.league !== SITE_LEAGUE ||
        !Number.isFinite(Date.parse(backup.createdAt)) ||
        !Array.isArray(backup.records) ||
        !backup.records.some((r) => r.id === 'main' && Array.isArray(r.data?.levels))
      )
        throw Error('Wybierz oryginalną kopię JSON pobraną z tej ligi.');
      setPending({ backup, revision, filename: file.name });
      setConfirmed(false);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? 'Plik nie jest prawidłową kopią JSON.'
          : e instanceof Error
            ? e.message
            : 'Nie udało się odczytać pliku.',
      );
    } finally {
      setWorking(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function restore() {
    if (!pending || !confirmed || busy) return;
    setWorking(true);
    setError('');
    try {
      if (await onRestore(pending.backup, pending.revision)) {
        setPending(null);
        setRecovery(true);
        setMessage('Przywrócono kopię. Stan sprzed przywrócenia możesz pobrać poniżej.');
      } else
        setError('Nie przywrócono kopii. Sprawdź komunikat, zamknij okno i ponownie wybierz plik.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <Collapsible className="season-management backup-panel">
      <CollapsibleTrigger className="season-management-trigger">
        <span>
          <ShieldCheck size={17} aria-hidden="true" /> Kopie zapasowe
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="season-management-content">
        <p>
          Pobierz bieżący sezon i całe archiwum: pary, wyniki, harmonogram oraz kody do meczów i
          sędziowania. Plik zawiera prywatne kody — zachowaj go dla organizatora.
        </p>
        <div className="backup-actions">
          <button className="button outline" disabled={busy} onClick={() => download()}>
            <Download size={17} /> Pobierz kopię zapasową
          </button>
          <button
            className="button outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={17} /> Przywróć z pliku
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Plik kopii zapasowej"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
          }}
        />
        {recovery && (
          <button
            className="text-button backup-recovery"
            disabled={busy}
            onClick={() => download(true)}
          >
            <Download size={15} /> Pobierz kopię sprzed ostatniego przywrócenia
          </button>
        )}
        {working && (
          <p role="status">
            <Loader2 size={16} className="spin" /> Przetwarzanie kopii…
          </p>
        )}
        {message && (
          <p role="status" className="backup-success">
            {message}
          </p>
        )}
        {error && !pending && (
          <p role="alert" className="backup-error">
            {error}
          </p>
        )}
      </CollapsibleContent>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPending(null);
            setError('');
          }
        }}
      >
        <DialogContent className="app-dialog">
          <DialogTitle>Przywróć kopię zapasową</DialogTitle>
          <DialogDescription>
            Zastąpisz bieżący sezon i archiwum danymi z wybranego pliku. Przed zmianą automatycznie
            zachowamy kopię obecnego stanu.
          </DialogDescription>
          {pending && (
            <div className="stack-form">
              <dl className="backup-summary">
                <dt>Plik</dt>
                <dd>{pending.filename}</dd>
                <dt>Utworzono</dt>
                <dd>
                  {new Date(pending.backup.createdAt).toLocaleString('pl-PL', {
                    timeZone: 'Europe/Warsaw',
                  })}
                </dd>
                <dt>Sezon</dt>
                <dd>
                  {pending.backup.records.find((r) => r.id === 'main')?.data.season ||
                    'Jeszcze nie ustawiono'}
                </dd>
                <dt>Sezony w archiwum</dt>
                <dd>{pending.backup.records.filter((r) => r.id.startsWith('archive:')).length}</dd>
              </dl>
              <p className="form-note">
                Kody meczów wrócą do stanu z kopii. Zawodnicy i sędziowie będą musieli zalogować się
                ponownie. Kod organizatora pozostanie bez zmian.
              </p>
              <label className="backup-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>Potwierdzam zastąpienie bieżących danych tą kopią.</span>
              </label>
              {error && (
                <p role="alert" className="backup-error">
                  {error}
                </p>
              )}
              <button className="button dark full" disabled={busy || !confirmed} onClick={restore}>
                {busy ? <Loader2 size={17} className="spin" /> : <Upload size={17} />} Przywróć dane
              </button>
              <button
                className="button outline full"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setError('');
                }}
              >
                Anuluj
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
