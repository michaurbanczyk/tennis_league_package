# Przebudowa obecnej aplikacji — krok 5

Zakres do przeglądu: rozdzielenie aktywnej ligi na metadane turnieju, rekordy
poziomów i rekordy meczów.

## Struktura danych

- `boards.data` dla aktywnej ligi zawiera metadane turnieju; lista poziomów i mecze
  zostały przeniesione do osobnych tabel.
- Nowa tabela `level_rows` przechowuje metadane poziomu i jego kolejność.
- `match_rows` przechowuje osobny JSON i rewizję każdego meczu.
- `level_matches` przechowuje relację między poziomem a meczem oraz kolejność meczu
  w drabince.
- Migracja `0003_level_rows.sql` tworzy `level_rows`, przenosi poziomy z aktywnej
  ligi i usuwa `levels` z jej dokumentu. Archiwa pozostają dotychczasowymi
  snapshotami. `0004_level_matches.sql` przenosi relacje do osobnej tabeli.
- Skrypty lokalnej i zdalnej inicjalizacji uruchamiają backfill brakujących meczów
  i poziomów.

## Zapis i odczyt

`GET /api/league` składa aktywną ligę z metadanych, poziomów i meczów. Endpointy
pojedynczego poziomu i meczu czytają bezpośrednio z nowych tabel. Zapis wyniku
aktualizuje tylko zmienione rekordy meczów oraz mały licznik rewizji w `boards`;
nie zapisuje ponownie dokumentu ligi. Operacje organizatora synchronizują poziomy
i mecze atomowo z metadanymi ligi. Backup i odtworzenie zachowują pełny format
dotychczasowej kopii.

## Zmiana lokalnej bazy

Uruchomiono `npm run db:local:init`. Lokalna D1 potwierdziła istniejącą tabelę
`match_rows`, zapełniła `level_rows` i usunęła `levels` z `boards.data`. Odczyt
kontrolny zwrócił 15 poziomów, 480 meczów i `embedded_levels: null`. Migracja
`0004` zapełniła `level_matches`; odczyt kontrolny potwierdził 480 relacji.
Nie wykonywano migracji na środowisku developerskim ani produkcyjnym.

## Weryfikacja

- `npm run check`, `npm run build` i `git diff --check` — poprawnie.
- Nie udało się połączyć z `http://127.0.0.1:5174` do sprawdzenia endpointów.
- Testów automatycznych nie uruchomiono.
