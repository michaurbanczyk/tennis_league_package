'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Level } from '@/lib/tennis';
export type ManageLevel = (action: string, extra: Record<string, unknown>) => Promise<boolean>;
export function LevelManager({
  level,
  busy,
  revision,
  onManage,
}: {
  level?: Level;
  busy: boolean;
  revision: number;
  onManage: ManageLevel;
}) {
  const [editing, setEditing] = useState<{
      mode: 'add' | 'rename';
      id?: string;
      revision: number;
    } | null>(null),
    [name, setName] = useState(''),
    [kind, setKind] = useState('single');
  const [deleting, setDeleting] = useState<{ id: string; name: string; revision: number } | null>(
      null,
    ),
    [password, setPassword] = useState(''),
    [localBusy, setLocalBusy] = useState(false),
    [error, setError] = useState('');
  const blocked = busy || localBusy;
  function edit(mode: 'add' | 'rename') {
    setEditing({ mode, id: level?.id, revision });
    setName(mode === 'rename' ? level?.name || '' : '');
    setKind('single');
    setError('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || blocked) return;
    setLocalBusy(true);
    setError('');
    try {
      if (
        await onManage(editing.mode === 'add' ? 'add_level' : 'rename_level', {
          name: name.trim().normalize('NFC').replace(/ +/g, ' '),
          levelId: editing.id,
          revision: editing.revision,
          doubles: kind === 'doubles',
        })
      )
        setEditing(null);
    } finally {
      setLocalBusy(false);
    }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!deleting || blocked) return;
    const adminPassword = password;
    setPassword('');
    setLocalBusy(true);
    setError('');
    try {
      if (
        await onManage('delete_level', {
          levelId: deleting.id,
          revision: deleting.revision,
          confirm: true,
          adminPassword,
        })
      ) {
        setDeleting(null);
        setEditing(null);
      } else
        setError(
          'Nie usunięto poziomu. Sprawdź komunikat i spróbuj ponownie. Jeżeli dane się zmieniły, zamknij to okno i otwórz potwierdzenie ponownie.',
        );
    } finally {
      setLocalBusy(false);
    }
  }
  return (
    <div className="level-manager">
      <div className="level-manager-actions">
        <button
          type="button"
          className="button outline"
          disabled={blocked}
          onClick={() => edit('add')}
        >
          <Plus size={16} /> Dodaj poziom
        </button>
        <button
          type="button"
          className="button outline"
          disabled={blocked || !level}
          onClick={() => edit('rename')}
        >
          <Pencil size={16} /> Zmień nazwę
        </button>
        <button
          type="button"
          className="button outline reset-trigger"
          disabled={blocked || !level}
          onClick={() => {
            if (level) {
              setDeleting({ id: level.id, name: level.name, revision });
              setPassword('');
              setError('');
            }
          }}
        >
          <Trash2 size={16} /> Usuń poziom
        </button>
      </div>
      {editing && (
        <form className="stack-form level-name-form" onSubmit={save}>
          <label>
            {editing.mode === 'add' ? 'Nazwa nowego poziomu' : 'Nowa nazwa poziomu'}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              disabled={blocked}
              autoFocus
            />
          </label>
          {editing.mode === 'add' && (
            <label>
              Rodzaj rozgrywek
              <Select value={kind} onValueChange={setKind} disabled={blocked}>
                <SelectTrigger className="format-select" aria-label="Rodzaj rozgrywek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Gra pojedyncza</SelectItem>
                  <SelectItem value="doubles">Debel</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
          {editing.mode === 'rename' && <p>Zmiana nazwy zachowa pary, wyniki, terminy i kody.</p>}
          <div className="level-manager-actions">
            <button className="button dark" disabled={blocked || !name.trim()}>
              {localBusy ? <Loader2 size={16} className="spin" /> : null}
              {editing.mode === 'add' ? 'Dodaj poziom' : 'Zapisz nazwę'}
            </button>
            <button
              type="button"
              className="button outline"
              disabled={blocked}
              onClick={() => setEditing(null)}
            >
              Anuluj
            </button>
          </div>
        </form>
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !blocked) {
            setDeleting(null);
            setPassword('');
            setError('');
          }
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogTitle>Usunąć poziom „{deleting?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Usuniesz ten poziom wraz ze wszystkimi parami, meczami, wynikami, terminami i kodami.
            Zniknie z tablicy wyników, planu gier, wyników na żywo i widoku TV. Tej operacji nie
            można cofnąć. Pozostałe poziomy i wcześniejsze sezony w archiwum pozostaną zachowane.
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
              {localBusy ? <Loader2 size={17} className="spin" /> : <Trash2 size={17} />} Tak, usuń
              poziom i jego wyniki
            </button>
            <AlertDialogCancel className="button outline full" disabled={blocked}>
              Anuluj
            </AlertDialogCancel>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
