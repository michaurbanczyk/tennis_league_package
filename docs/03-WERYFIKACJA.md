# Sprawdzenie migracji — 22.09.2026

Testy uruchomiono oddzielnie dla obu wygenerowanych aplikacji, z niezależnymi testowymi bazami. Nie wpisywano testowych wyników do produkcji.

| Zakres | Sposób sprawdzenia | Wynik |
|---|---|---|
| Strona główna / tablica wyników | Porównanie pliku głównego widoku bajt po bajcie, render Home przed/po, uruchomienie podglądu | Zgodność |
| Wygląd | Oba arkusze CSS dla każdej ligi i kod TV/wyszukiwarki identyczne z bazową wersją | Zgodność |
| Formularz par i panel kopii | Porównanie wyrenderowanego HTML przed/po | Zgodność |
| Harmonogram | Istniejące testy sortowania, dat, kolejki, pustych kortów, konfliktów i edycji | PASS obu lig |
| Wyniki i zapis | Testy rozpoczęcia, punktów, gemów, setów, tie-breaków, cofania i zakończenia | PASS obu lig |
| Drabinka | 4/8/16 zawodników, awans, mecz o 3. miejsce, blokada cofania po rozpoczęciu kolejnej rundy | PASS obu lig |
| Cały turniej od 1/8 | Pełna drabinka zakończona przez API w obu oddzielnych instancjach testowych | PASS obu lig |
| Sędziowanie | Osobne kody, punkty, cofanie, uprawnienia, wymiana kodu i utrata poprzedniego dostępu | PASS obu lig |
| Organizator | Edycja, poziomy, nazwy, usuwanie, archiwizacja i zerowanie z potwierdzeniem oraz hasłem | PASS obu lig |
| Logowanie | Osobne sekrety testowe, brak dostępu sesją drugiej ligi, host-only cookie | PASS |
| Zapisy równoczesne | Zachowanie rewizji i brak nadpisania konkurencyjnej zmiany | PASS |
| Kopie | Pobranie/odtworzenie, punkty i kody sędziego, archiwa, kopia sprzed odtworzenia | PASS obu lig |
| Separacja kopii | Odrzucenie kopii drugiej ligi bez zmiany danych | PASS |
| Limit 12 godzin | Granica 12 h, przejście przez północ i zmianę czasu, zachowanie punktów, wznowienie | PASS obu lig |
| Izolacja danych | Zmiana sezonu, utworzenie drabinki i cały turniej jednej ligi nie zmieniają drugiej bazy | PASS |
| Baza produkcyjna | Brak zmian schematu, migracji SQL, adaptera bazy, tożsamości projektów i sekretów | Zachowane |
| Generator | Oddzielne eksporty i odmowa zapisania jednej ligi do projektu drugiej | PASS |
| TypeScript | `check:smartliga` i `check:relaksmisja` | PASS |
| Niezależne buildy | `build:smartliga` i `build:relaksmisja` | PASS |
| Podgląd w przeglądarce | Strona główna, tablica wyników, plan gier, wyniki na żywo i TV osobno dla obu lig | PASS na lokalnych danych testowych |
| Filtry TV Relaksmisji | Wszystkie: 9 kortów, FAME: 6, FLEX: 3, przełączanie przyciskami | PASS |

## Opublikowane wersje

Oba niezależne wdrożenia zakończyły się statusem `succeeded` 22.09.2026. Zachowano dotychczasowy publiczny dostęp oraz konfiguracje baz i środowiska.

| Liga | Wersja | Commit wdrożenia | Adres |
|---|---|---|---|
| SmartLiga | 38 | `6b17bf42d66e37d234a3aa7b5848b68b9d170ec2` | https://smarttenis-live.sss115.chatgpt.site |
| Relaksmisja | 17 | `f68915b6b2f78aaed945c02913d6d390e8e23843` | https://relaksmisja-live.sss115.chatgpt.site |

Podglądy w przeglądarce korzystały z lokalnego, pustego stanu. Scenariusze z meczami, zapisem wyników, logowaniem i panelem organizatora sprawdzono testami na oddzielnych bazach testowych. Publikację potwierdziła usługa wdrożeniowa; nie wykonywano testowych zapisów w działających ligach.

## Zestawy testów

W obu ligach wykonano `referee.cjs`, `schedule-backups.cjs`, `reset-league.cjs`, `level-management.cjs`, `live-expiry.cjs`, `horizontal-bracket.cjs` i `live-courts.mjs`. Dodatkowy historyczny `league.mjs`, zawierający stałe założenia SmartLigi, jest uruchamiany w SmartLidze. Przeniesiono go do modułu tej ligi. Obie ligi obejmuje też test `tests/migration.mjs` wspólnego projektu.

`tests/parity.mjs` porównał oba wygenerowane projekty z oryginałami przed nadpisaniem kopii wdrożeniowych. Wyniki renderowania Home, panelu kopii, formularza par, drabinki i TV były identyczne. Zachowanie parserów kortów, harmonogramu i punktacji również pozostało zgodne.

## Problem istniejący przed migracją

Test `live-courts.mjs` Relaksmisji był skopiowany ze SmartLigi i oczekiwał pięciu kortów, chociaż aplikacja poprawnie udostępnia dziewięć. Zmieniono oczekiwanie testu według konfiguracji ligi. Nie zmieniono działania aplikacji, aby dopasować je do błędnego testu.

## Zakres pewności

To potwierdzenie konkretnych wykonanych kontroli, nie matematyczna gwarancja wszystkich możliwych zachowań. Główne widoki i style zachowano dosłownie, a zmiany w logice ograniczono do importowania tych samych funkcji z modułów współdzielonych. Kontrole zapisów i działań organizatora przeprowadzono na bazach testowych; nie wykonywano takich operacji na bieżących danych produkcyjnych.

Podgląd D1 przez narzędzie administracyjne skraca duże pola JSON, dlatego nie przedstawiamy takiego odczytu jako pełnego eksportu danych. Paczka zawiera kopie kodu. Bieżące dane nadal znajdują się w swoich istniejących bazach, a ich pełne kopie pobiera organizator dotychczasową funkcją „Kopie zapasowe”.
