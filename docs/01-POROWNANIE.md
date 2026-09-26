# Porównanie przed migracją — 22.09.2026

Punkty odniesienia: SmartLiga v37, commit `2f57f870d732a3a4eea5806d5a4a7f2b090c6656`; Relaksmisja v16, commit `a0d483aef2f1f3ffe9fc4d1b7906432e8d8b304e`. Zabezpieczono pełne kopie śledzonych źródeł obu commitów, bez lokalnych sekretów i baz.

Porównano 136 śledzonych plików SmartLigi i 138 Relaksmisji. 124 pliki były identyczne. Różniło się 12 wspólnych ścieżek. Relaksmisja miała dodatkowo moduł kortów i cache TypeScript. Cache nie jest potrzebny w źródłowym repozytorium.

## Funkcje i zachowane różnice

| Obszar | SmartLiga | Relaksmisja |
|---|---|---|
| Wygląd | Dotychczasowe logo, kolory, teksty i style | Dotychczasowe logotypy i styl RTL |
| Sezon | Rok i numer 1–3; walidacja po stronie serwera | Dowolna nazwa, np. Lato 2026 |
| Daty finałów | 2 daty | 4 daty, opisane jako 2 weekendy po 2 dni |
| Korty | 1–5; dotychczasowe numery i podpisy | FAME 1–6 i FLEX 1–3; stabilne identyfikatory 1–9 |
| Poziomy początkowe | 6 poziomów | 15 poziomów, w tym deblowe i +50 |
| Puste poziomy na tablicy | Pozostają widoczne | Ukrywane do ustawienia par; liczniki uwzględniają widoczne poziomy |
| Tryb demonstracyjny | Dotychczasowy przykład SmartLigi | Brak demonstracyjnego poziomu przy pustej bazie |
| Nagłówek rund | Dotychczasowy tekst zachowany | Opis rund pod nazwą sezonu ukryty |
| Wyszukiwanie | Dotychczasowy wynik wyszukiwania | Dodatkowo punkty w gemie dla meczu sędziowanego |
| TV | 5 kortów | 9 kortów i filtr Wszystkie/FAME/FLEX, zapamiętany na urządzeniu |
| Sędziowanie | Osobny kod i punkty, cofanie, rotacja kodu | To samo |
| Drabinka | Start od 1/8, ćwierćfinału lub półfinału | To samo |
| Plan gier | Terminy i filtry właściwe dla 5 kortów i 2 dat | Terminy i filtry właściwe dla 9 kortów i 4 dat |
| Organizator | Pary, edycja, poziomy, sezony, archiwum, zerowanie, kopie | Te same funkcje z własnymi regułami sezonu i kortów |
| Limit live | 12 h od startu/wznowienia, przez północ; status niedokończony | To samo |
| Najbliższy mecz w TV | Jedno miejsce w głównej części lub stopce | To samo |

W istniejących aplikacjach „tabela ligi” jest tablicą wyników i drabinką finałów. Nie było osobnego rankingu ligowego i migracja go nie dodaje.

## Współdzielenie

Bez zmian treści przeniesiono m.in. komponenty UI, zarządzanie poziomami, sędziowanie, poziomą drabinkę, grafikę, wyszukiwarkę tekstową jako logikę, logikę kopii, walidację konfliktów i zależności. Dotychczasowy `lib/tennis.ts` Relaksmisji jest wspólnym rdzeniem punktacji, startu/cofania, wygasania i drabinek. Dwa istniejące parsery/etykiety kortów SmartLigi przeniesiono dosłownie do jej modułu `lib/courts.ts`.

API obu lig różniło się wyłącznie walidacją nazwy sezonu, liczby dat i numeru kortu. Te funkcje wyodrębniono do dwóch małych modułów `lib/league-policy.ts`. Po ich wyodrębnieniu kod API obu wersji jest identyczny i występuje raz w `shared/app/api/league/route.ts`.

Formularz drabinki korzysta ze wspólnego komponentu i osobnego modułu kortów. SmartLiga nadal wyświetla numery, a Relaksmisja pełne nazwy. Panel kopii ma ten sam wyrenderowany tekst — obie ligi mają już sędziowanie.

Główne strony, style, TV i wyszukiwanie pozostają osobnymi modułami. Nie usuwano pozornie zbędnych reguł CSS ani istniejących warunków w zachowanych widokach, żeby nie rozszerzać zakresu refaktoru.

## Baza i logowanie

Schemat jest identyczny: `boards`, `sessions`, `attempts`. W `boards` pozostają bieżący sezon, archiwa i kopie sprzed przywrócenia. Obie aplikacje używają nazwy wiązania `DB`, ale wiązanie jest lokalne dla oddzielnego projektu wdrożenia.

Nie ma migracji schematu ani przenoszenia rekordów. Zachowano `ADMIN_CODE` jako istniejący, osobny sekret organizatora każdego wdrożenia. Nie dodano systemu kont użytkowników ani nowych wspólnych kont. Sesje pozostają w oddzielnych bazach; ciasteczko sesji nie ma parametru `Domain`, więc jest przypisane do hosta.

Format kopii zawiera identyfikator ligi; odtworzenie kopii drugiej ligi jest odrzucane. Istniejące odnośniki nawigacyjne między stronami nie przenoszą danych ani sesji i pozostają bez zmian.
