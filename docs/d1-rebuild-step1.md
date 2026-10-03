# Przebudowa obecnej aplikacji — krok 1

Zakres do przeglądu: usunięcie cofania wyniku i automatycznego limitu czasu meczu.
Ten krok przygotowuje aplikację do oddzielnego przechowywania meczów w D1.

## Zmiana zachowania

- API odrzuca komendę `undo`; przycisk cofania został usunięty również z trybu demo.
- Punktacja, start i zakończenie nie tworzą już snapshotów historii wyniku.
- Odpowiedzi nie zawierają `history` ani `canUndo`.
- Zakończony wynik pozostaje zakończony. Nie można ponownie otworzyć go przez undo.
- Mecze nie przechodzą automatycznie do `unfinished`, niezależnie od czasu trwania.
- Odczyt ligi nie normalizuje statusów i nie zapisuje zmian do bazy.
- Przeglądarka nie planuje odświeżenia po 12 godzinach.
- Wyświetlany czas trwania nie zatrzymuje się na 12 godzinach.
- Zegar nadal liczy czas od rzeczywistego początku; mecz kończy się ręcznie.

Istniejące rekordy o statusie `unfinished` zachowują ten status i możliwość ręcznego
wznowienia. Żaden rekord nie jest przestawiany na live tylko dlatego, że usunięto
limit. Komunikaty o limicie czasu zostały usunięte.

## Stare dane i kopie

Stare rekordy mogą jeszcze zawierać historyczne snapshoty w bazie. Są ignorowane
i usuwane z edytowanego meczu przy kolejnym udanym zapisie. Nie wykonano masowego
czyszczenia istniejącej bazy ani zmiany jej schematu.

Eksport nie zawiera historii cofania. Import wcześniejszych kopii nadal działa,
ale pomija historię i nie zmienia statusu długotrwałego meczu. Możliwość odtworzenia
całej kopii, reset ligi i usunięcie kategorii to oddzielne funkcje organizatora.

## Weryfikacja

Testy obejmują brak historii po setkach punktów, odrzucenie undo bez zmiany wyniku,
brak zapisów podczas GET, mecz live po 48 godzinach, punktację takiego meczu,
zachowanie czasu przez zmianę strefy/DST oraz zgodność wcześniejszych kopii.
Pozostałe testy sprawdzają punktację, awans, sesje, uprawnienia i konflikty zapisu.

## Kolejny krok

Endpointy odczytu pojedynczej drabinki i meczu oraz zapis wyniku przez adres
konkretnego meczu opisano w [kroku 2](d1-rebuild-step2.md). Dane nadal znajdują
się w `boards.data`; migracja do osobnych rekordów meczów jest kolejnym etapem.
