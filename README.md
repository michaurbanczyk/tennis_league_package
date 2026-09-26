# Ligi tenisowe — jeden codebase, dwa niezależne wdrożenia

To uporządkowane źródła istniejących aplikacji SmartLiga i Relaksmisja. Nie są nową implementacją. Główne strony, style, wyszukiwarki i widoki TV bazują na dotychczasowym kodzie. Aktualizacja z 24.09.2026 zmienia konfigurację rozgrywek wyłącznie w Relaksmisji, zgodnie z zamówieniem; szczegóły w `docs/04-ZMIANY-2026-09-24.md`. Wspólna punktacja, API i komponenty są utrzymywane w jednym miejscu.

## Struktura

| Katalog | Przeznaczenie |
|---|---|
| `shared/` | Wspólny kod aplikacji, API, punktacja, drabinki, walidacja harmonogramu, kopie, komponenty, grafiki, zależności i migracje |
| `leagues/smartliga/league.config.json` | Tożsamość i konfiguracja niezależnego wdrożenia SmartLigi |
| `leagues/smartliga/modules/` | Widoki, style, reguły sezonu i korty SmartLigi |
| `leagues/relaksmisja/league.config.json` | Tożsamość i konfiguracja niezależnego wdrożenia Relaksmisji |
| `leagues/relaksmisja/modules/` | Widoki, style, reguły sezonu, konfigurowalne korty, formularz pustej drabinki i moduł TV Relaksmisji |
| `scripts/` | Przygotowanie, eksport, niezależne budowanie i uruchamianie testów |
| `tests/` | Testy migracji, separacji i zgodności z poprzednimi wersjami |
| `.generated/<liga>/` | Odtwarzalny, samodzielny projekt wybranej ligi; ignorowany przez Git |
| `.exports/<liga>/` | Odtwarzalny eksport do wdrożenia lub przekazania; ignorowany przez Git |

Plik źródłowy ma jednego właściciela: `shared/` albo moduł konkretnej ligi. Generator odmawia pracy, gdy dwa pliki próbują obsługiwać tę samą ścieżkę. Nie ma wykonywanego w aplikacji wyboru bazy na podstawie domeny, parametru URL czy kliknięcia użytkownika.

## Uruchomienie

Wymagania: Node.js co najmniej 22.13, pnpm zgodny z `shared/package.json` i dostęp do rejestru pakietów przy pierwszej instalacji. Testy wykorzystujące `node:sqlite` sprawdzono na Node.js 24.19.0. Użyj Node.js 24 LTS do pełnego zestawu testów.

SmartLiga:

```bash
npm run install:smartliga
npm run check:smartliga
npm run test:smartliga
npm run build:smartliga
```

Relaksmisja:

```bash
npm run install:relaksmisja
npm run check:relaksmisja
npm run test:relaksmisja
npm run build:relaksmisja
```

Podgląd: `npm run dev:smartliga` albo `npm run dev:relaksmisja`. Każdy wygenerowany projekt ma własny katalog stanu lokalnego i własne pliki środowiska. Konfiguracja bazy i sekretu `ADMIN_CODE` nadal jest potrzebna, tak samo jak przed uporządkowaniem kodu; szczegóły w `docs/02-WDROZENIA-I-DANE.md`.

Oba eksporty, bez instalowania zależności:

```bash
npm run export:smartliga
npm run export:relaksmisja
```

Wskazanie pustego katalogu docelowego:

```bash
node scripts/league.mjs export smartliga /sciezka/smartliga
node scripts/league.mjs export relaksmisja /sciezka/relaksmisja
```

Eksport zawiera kompletną aplikację wybranej ligi. Nie potrzebuje uruchomionej drugiej aplikacji ani jej kodu. Nie zawiera sekretów ani danych produkcyjnych. Generator sprawdza tożsamość docelowego projektu i blokuje eksport Relaksmisji do katalogu oznaczonego jako SmartLiga oraz odwrotnie.

## Dalsze zmiany

Edytuj `shared/` dla funkcji wspólnych, a `leagues/<liga>/modules/` dla funkcji konkretnej ligi. Nie edytuj ręcznie `.generated/`, `.exports/` ani gotowych kopii wdrożeniowych. Po zmianie wspólnego kodu sprawdź obie ligi; każdą można zbudować i wdrożyć w innym terminie. Publikacja jednej nie publikuje drugiej.

Flagi w konfiguracji opisują wybrany moduł. Obie ligi mają włączone `refereeMode` i `roundOf16Bracket`, a `tvCourtFilters` i `bracketEditor` są włączone tylko w Relaksmisji. Pola `courtCount` i `finalsDateCount` opisują ustawienia domyślne; w Relaksmisji organizator może zmienić je dla konkretnego sezonu. Zmiana flagi wymaga zgodnego modułu i testów — eksport zatrzyma się przy sprzecznej konfiguracji.

Nie zmieniaj istniejących identyfikatorów lig (`smart`, `relaksmisja`), projektów, poziomów, kortów ani migracji już zastosowanych w produkcji. Stanowią część zgodności z zapisanymi danymi.

## Kontrola migracji

Po przygotowaniu i instalacji obu lig:

```bash
npm run test:migration
node tests/parity.mjs /katalog/starej/SmartLigi /katalog/starej/Relaksmisji
```

Druga komenda jest historycznym testem migracji z 22.09.2026, przed zamówionymi później zmianami. Nie oczekuje się zgodności obecnego interfejsu Relaksmisji z tamtą wersją. Porównuje kod stylów i ważnych widoków bajt po bajcie oraz renderowane komponenty, punktację i harmonogram z oryginałami. Kopie oryginałów są w katalogu `backups/` obok `ligi-codebase/` w paczce dostarczonej po migracji.

Opis różnic: `docs/01-POROWNANIE.md`. Wdrożenia i dane: `docs/02-WDROZENIA-I-DANE.md`. Wyniki sprawdzenia: `docs/03-WERYFIKACJA.md`.

Aktualne testy nowego zakresu:

```bash
npm run test:archives
npm run test:rtl-workflow
```

Relaksmisja zapisuje kopie w formacie v3 (z rozstawieniem) i nadal odczytuje dotychczasowe v1 oraz v2. SmartLiga pozostaje przy v1. Kopii v3 nie należy przywracać w starszym wdrożeniu Relaksmisji — wymaga ono aktualizacji.

Opcjonalne rozstawienie i limit 10 terminów opisuje `docs/07-ROZSTAWIENIE-I-LIMIT-DNI.md`. Test: `npm run test:seeds`.
