import { LevelManager, type ManageLevel } from './level-manager';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Board } from '@/lib/tennis';
import { Loader2, Plus } from 'lucide-react';
export function BracketSetup({
  board,
  names,
  name,
  onName,
  size,
  onSize,
  format,
  onFormat,
  busy,
  revision,
  onManage,
  onSubmit,
}: {
  board: Board;
  names: string[];
  name: string;
  onName: (name: string) => void;
  size: number;
  onSize: (size: number) => void;
  format: string;
  onFormat: (format: string) => void;
  busy: boolean;
  revision: number;
  onManage: ManageLevel;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const selected = board.levels.find((l) => l.name === name),
    hasData = selected?.matches.some(
      (m) =>
        m.configured ||
        m.players.some(Boolean) ||
        m.court ||
        m.date ||
        m.time ||
        m.codeHash ||
        m.currentCode ||
        m.status !== 'scheduled',
    );
  return (
    <>
      <div className="stack-form">
        <label className="field-label" id="setup-level-label">
          Poziom rozgrywek
        </label>
        <Select value={selected?.name || ''} onValueChange={onName} disabled={busy}>
          <SelectTrigger className="format-select" aria-labelledby="setup-level-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {names.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <LevelManager level={selected} busy={busy} revision={revision} onManage={onManage} />
      </div>
      {!selected ? (
        <p>Wybierz poziom lub dodaj nowy.</p>
      ) : hasData ? (
        <p className="bracket-setup-note">
          Drabinka zawiera już mecze. Uzupełniaj je przez „Edytuj mecz” bezpośrednio w drabince.
        </p>
      ) : (
        <form className="stack-form" onSubmit={onSubmit}>
          <label className="field-label" id="setup-round-label">
            Rundy play-off
          </label>
          <Select value={String(size)} onValueChange={(v) => onSize(Number(v))} disabled={busy}>
            <SelectTrigger className="format-select" aria-labelledby="setup-round-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Finał</SelectItem>
              <SelectItem value="4">Półfinał + finał</SelectItem>
              <SelectItem value="8">Ćwierćfinał + półfinał + finał</SelectItem>
              <SelectItem value="16">1/8 + ćwierćfinał + półfinał + finał</SelectItem>
              <SelectItem value="32">1/16 + 1/8 + ćwierćfinał + półfinał + finał</SelectItem>
            </SelectContent>
          </Select>
          <p className="bracket-setup-note">
            Powstanie pusta drabinka dla {size} zawodników lub par.
            {size > 2 ? ' Zawiera także mecz o 3. miejsce.' : ''} Kliknij mecz w drabince, aby
            uzupełnić zawodników i termin.
          </p>
          <div className="round-format-settings">
            {[...[32, 16, 8, 4, 2].filter((n) => n <= size), ...(size > 2 ? [0] : [])].map(
              (round) => (
                <label key={round}>
                  <span>
                    {
                      {
                        32: '1/16 finału',
                        16: '1/8 finału',
                        8: 'Ćwierćfinały',
                        4: 'Półfinały',
                        2: 'Finał',
                        0: 'O 3. miejsce',
                      }[round]
                    }
                  </span>
                  <Select name={'roundFormat-' + round} defaultValue={format} disabled={busy}>
                    <SelectTrigger
                      className="format-select"
                      aria-label={
                        'Format rundy ' +
                        {
                          32: '1/16 finału',
                          16: '1/8 finału',
                          8: 'Ćwierćfinały',
                          4: 'Półfinały',
                          2: 'Finał',
                          0: 'O 3. miejsce',
                        }[round]
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Do dwóch wygranych setów</SelectItem>
                      <SelectItem value="super">Super tie-break zamiast 3. seta</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              ),
            )}
          </div>
          <button className="button dark full" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Plus size={18} />} Utwórz pustą
            drabinkę
          </button>
        </form>
      )}
    </>
  );
}
