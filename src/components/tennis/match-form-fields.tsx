import { courtEntries } from '@/lib/court-config';
import { courtNumber, dateLabel, type Board } from '@/lib/tennis';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CourtSelect({
  name,
  value = '',
  disabled = false,
  board,
}: {
  name: string;
  value?: string;
  disabled?: boolean;
  board: Board;
}) {
  return (
    <Select
      name={name}
      defaultValue={courtNumber(value, board) || 'unassigned'}
      disabled={disabled}
    >
      <SelectTrigger className="format-select" aria-label="Numer kortu">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Kort do ustalenia</SelectItem>
        {courtEntries(board).map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function MatchDateSelect({
  name,
  dates,
  value,
  disabled = false,
}: {
  name: string;
  dates: string[];
  value?: string;
  disabled?: boolean;
}) {
  if (!dates.length)
    return (
      <input type="date" name={name} defaultValue={value || 'unassigned'} disabled={disabled} />
    );
  const options = value && !dates.includes(value) ? [...dates, value].sort() : dates;
  return (
    <Select name={name} defaultValue={value || 'unassigned'} disabled={disabled}>
      <SelectTrigger className="format-select" aria-label="Data meczu">
        <SelectValue placeholder="Wybierz datę" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Data do ustalenia</SelectItem>
        {options.map((date) => (
          <SelectItem key={date} value={date}>
            {dateLabel(date)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
