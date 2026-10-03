# Przebudowa obecnej aplikacji — krok 2

Zakres do przeglądu: osobne endpointy do odczytu jednej drabinki i meczu oraz
zapis wyniku przez endpoint konkretnego meczu.

## Dodane endpointy

- `GET /api/levels/{levelId}/draw` zwraca wybraną drabinkę, metadane potrzebne do
  jej wyświetlenia i rewizje jej meczów.
- `GET /api/matches/{matchId}` zwraca jeden mecz wraz z podstawowymi danymi
  kategorii i turnieju.
- `POST /api/matches/{matchId}/actions` obsługuje start, punkt, wpisanie gema
  i zakończenie meczu. Używa istniejącej transakcyjnej ścieżki zapisu, rewizji
  meczu i awansów.
- Interfejs wysyła komendy punktacji pod nowy endpoint. Pozostałe operacje nadal
  korzystają z `/api/league`.

Nowe odczyty używają SQLite JSON1, by wczytać z dokumentu tylko wskazaną drabinkę
lub mecz. Odpowiedzi usuwają prywatne kody i tokeny zgodnie z dotychczasowym
serializatorem. Odczyty są oznaczone `no-store`.

## Ograniczenia tego kroku

`boards.data` nadal przechowuje strukturę ligi i pozostaje potrzebny starszym
operacjom. Wydzielone endpointy ograniczają ilość danych przetwarzanych przez
JavaScript i zwracanych klientowi, ale same nie usuwają kosztu skanowania ani zapisu
dużego dokumentu. Dalsze przejście do rekordów meczów opisano w
[kroku 3](d1-rebuild-step3.md).

Stary endpoint `/api/league` pozostaje dostępny dla zgodności z pozostałymi
komendami i starszymi klientami. Nie zmieniono schematu D1 ani danych, nie wykonano
migracji i nie wdrożono tej zmiany.

## Weryfikacja

- `npm run check` — poprawnie.
- `npm run build` — poprawnie; kompilator zgłosił istniejące ostrzeżenie o dużym
  bundlu klienta.
- Nie uruchomiono testów ani wdrożenia w ramach tego kroku.
