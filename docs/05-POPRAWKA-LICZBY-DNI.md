# Poprawka wyboru liczby dni i kortów

Zakres: tylko Relaksmisja. Pole liczbowe przywracało poprzednią wartość po usunięciu ostatniej cyfry, co utrudniało zmianę na klawiaturze telefonu. Zastąpiono je istniejącym komponentem listy wyboru (1–31 dni). Ten sam błąd dotyczył liczby kortów; zastosowano analogiczną listę (1–32).

Bez zmian w API, danych i SmartLidze. Formularz bieżącego oraz nowego sezonu korzysta z poprawionego komponentu. W podglądzie sprawdzono zmianę 4→5 dni, zachowanie dotychczasowych dat, podanie piątej daty i zapis formularza; następnie zmianę 5→3 i zapis trzech dat. Sprawdzono także 6→2 korty FAME z zachowaniem identyfikatorów i pozostałej grupy. Kontrola TypeScript zakończona poprawnie. Długich testów całej aplikacji nie powtarzano.
