# Przebudowa obecnej aplikacji — krok 3

Zakres do przeglądu: zapełnienie istniejącej tabeli `match_rows` brakującymi
rekordami i użycie tych rekordów przy odczycie pojedynczego meczu lub drabinki.

## Migracja

Dodano `drizzle/0002_backfill_match_rows.sql`. Migracja bierze mecze z aktywnej
ligi (`boards.id = 'main'`) i wstawia tylko brakujące rekordy. Można ją uruchamiać
ponownie: istniejące dane i rewizje meczów pozostają bez zmian. Skrypty inicjalizacji
lokalnej, developerskiej i produkcyjnej uruchamiają backfill po sprawdzeniu lub
utworzeniu tabeli.

Nowe endpointy z kroku 2 zwracają dane meczu z `match_rows`; dokument ligi nadal
dostarcza kolejność i strukturę drabinki. Przy zapisie wyniku rekord meczu jest
odczytywany z tej tabeli, sprawdzany względem projekcji w `boards.data`, a następnie
aktualizowany w istniejącej transakcyjnej ścieżce punktacji.

## Zakres i ograniczenia

To przejściowy etap migracji. `boards.data` nadal jest potrzebny dla starszych
operacji i klientów. Zmiany administracyjne oraz edycja terminarza zapisują najpierw
projekcję ligi, po czym dotychczasowa synchronizacja odświeża `match_rows`. Pełne
odłączenie tabeli meczów od dokumentu ligi wymaga przeniesienia wszystkich zapisów
na wspólną transakcyjną warstwę i migracji pozostałych relacji. Nie zmieniono
istniejących danych w żadnym środowisku podczas pracy nad tym krokiem.

## Weryfikacja

Migracji nie uruchomiono na D1. Nie wykonano wdrożenia ani testów. Typy i build
przeszły w kroku 3, a przełączenie interfejsu na te odczyty opisano w
[kroku 4](d1-rebuild-step4.md).
