'use client';
import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export function ArchiveDelete({
  archive,
  revision,
  busy,
  onDelete,
}: {
  archive: { id: string; season: string };
  revision: number;
  busy: boolean;
  onDelete: (extra: Record<string, unknown>) => Promise<boolean>;
}) {
  const [pending, setPending] = useState<{ id: string; season: string; revision: number } | null>(
    null,
  );
  const [password, setPassword] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const blocked = busy || saving;
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || blocked) return;
    const adminPassword = password;
    setPassword('');
    setSaving(true);
    setError('');
    try {
      if (
        await onDelete({
          archiveId: pending.id,
          revision: pending.revision,
          confirm: true,
          adminPassword,
        })
      )
        setPending(null);
      else
        setError(
          'Nie usunięto sezonu. Sprawdź komunikat. Jeśli dane się zmieniły, zamknij okno i wybierz sezon ponownie.',
        );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="button outline reset-trigger"
        disabled={blocked}
        onClick={() => {
          setPending({ ...archive, revision });
          setPassword('');
          setError('');
        }}
      >
        <Trash2 size={16} /> Usuń sezon z archiwum
      </button>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !blocked) {
            setPending(null);
            setPassword('');
            setError('');
          }
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogTitle>Usunąć sezon „{pending?.season}” z archiwum?</AlertDialogTitle>
          <AlertDialogDescription>
            Usuniesz cały wybrany sezon wraz z jego poziomami, zawodnikami, meczami, wynikami i
            terminami. Bieżący sezon oraz pozostałe archiwa pozostaną zachowane. Tej operacji nie
            można cofnąć bez wcześniej pobranej kopii zapasowej.
          </AlertDialogDescription>
          <form className="stack-form" onSubmit={remove}>
            <label>
              Wpisz ponownie hasło organizatora
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={64}
                required
                disabled={blocked}
              />
            </label>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="button reset-danger full" disabled={blocked || password.length < 5}>
              {saving ? <Loader2 size={17} className="spin" /> : <Trash2 size={17} />} Tak, usuń
              sezon z archiwum
            </button>
            <AlertDialogCancel className="button outline full" disabled={blocked}>
              Anuluj
            </AlertDialogCancel>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
