export const MAX_LEVELS = 64;
export function normalizeLevelName(value: unknown): string {
  if (typeof value !== 'string') throw Error('Wpisz nazwę poziomu.');
  const name = value.trim().normalize('NFC').replace(/ +/g, ' ');
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name))
    throw Error('Nazwa poziomu musi mieć od 1 do 60 znaków.');
  return name;
}
export function levelNameKey(value: string) {
  return value.trim().normalize('NFC').replace(/ +/g, ' ').toLocaleLowerCase('pl-PL');
}
