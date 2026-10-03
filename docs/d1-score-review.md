# Pierwszy krok: mniejszy koszt zapisu wyniku w Workers + D1

Do przeglądu po wdrożeniu na `https://rtl.rtlfinals.workers.dev`.
Wersja Worker: `d65f5915-49d0-4e21-8e83-b1076ce07378`.

## Zachowanie

Frontend prosi o odpowiedź `match-delta` podczas startu, punktacji, zakończenia
i cofania wyniku. Worker pobiera z D1 tylko drabinkę tego meczu i konfigurację
kortów. Stosuje dotychczasowe reguły punktacji i awansu, a zapis obejmuje tylko
zmienione fragmenty dokumentu oraz odpowiednie rekordy `match_rows`.

Odpowiedź zawiera zmienione mecze i ich rewizje, bez całej ligi, historii wyników
czy prywatnych danych dostępowych. Organizator zachowuje dostęp do kodów.
Starsi klienci nadal mogą otrzymać dotychczasową pełną odpowiedź.

Frontend stosuje zmianę tylko do zgodnej rewizji. Jeżeli pominął inne aktualizacje,
pobiera aktualny stan. Powiadomienie socketu otrzymane w trakcie zapisu jest
odkładane do jego zakończenia, aby własny zapis nie wywoływał zbędnego pełnego odczytu.

Transakcja chroni zapis dokumentu i rekordów meczów razem. Konflikt wspólnej
rewizji powoduje ponowienie odczytu tej drabinki. Konflikt rewizji tego samego
meczu zwraca 409. Awans i jego cofnięcie zapisują również zmienione mecze potomne.

## Weryfikacja

- Pełna istniejąca seria testów i TypeScript: wynik pozytywny.
- Nowe testy: uprawnienia, prywatność, atomowy rollback, konflikty, równoległe
  zapisy, awans/undo, wygasanie live i scalanie odpowiedzi w przeglądarce.
- Osobny test Miniflare/workerd: rzeczywiste D1, JSON patch, `changes()`,
  transakcja batch, rewizje z `RETURNING` oraz zgodność pełnego odczytu.
- Lokalnie, 15 drabinek po 32 zgłoszenia: dane zwracane przez bazę do Workera
  podczas startu meczu zmalały z 403814 do 12964 bajtów; odpowiedź HTTP
  z 169089 do 596 bajtów. Są to wielkości danych, nie pomiar CPU Cloudflare.
- Na wdrożonym środowisku: start dwóch meczów równolegle, jeden sukces/jeden
  konflikt dla równoczesnego zapisu tego samego meczu, punktacja, undo,
  zakończenie i awans oraz cofnięcie awansu. Wszystkie asercje przeszły.
- Zapis pojedynczego wyniku na serwerze zwracał ok. 0,7 KB; zakończenie z awansem
  ok. 1,6 KB. W tym niewielkim scenariuszu nie wystąpił błąd 1102.
- Kategoria testowa została usunięta. Porównano istniejące kategorie przed i po
  teście; pozostały identyczne. Kopię przed testem zapisano poza repozytorium.

## Ograniczenia tego kroku

D1 nadal przechowuje całą ligę w JSON. SQL nadal wyszukuje drabinkę w dokumencie
i przepisuje go przy `json_set`; zmniejszono przede wszystkim pracę i ilość danych
w JavaScript Workera. Nadal istnieje wspólna rewizja dokumentu.

Pełne odczyty ligi, publikacja dla widzów i operacje organizatora na konfiguracji
wymagają osobnego kroku. Mały test wdrożeniowy nie potwierdza pojemności dla
setek widzów ani wielu dużych turniejów. Do oceny wydajności pozostaje pomiar CPU
i test obciążeniowy uzgodniony po przeglądzie.

## Pliki

- `src/lib/score-match.ts`: odczyt jednej drabinki i transakcja.
- `src/lib/match-score-action.ts`: wspólne reguły komend punktacji.
- `src/lib/public-match.ts`: bezpieczna serializacja meczu.
- `src/lib/match-delta.ts`: scalanie odpowiedzi i wykrywanie pominiętych zmian.
- `src/app/api/league/route.ts`, `src/app/page.tsx`: integracja.
- `tests/match-delta.cjs`, `tests/match-delta-d1.cjs`: testy zmiany.

Przegląd użytkownika powinien obejmować punktację, undo, widok awansu i odświeżanie
na drugim urządzeniu. Kolejny krok wymaga tego przeglądu.
