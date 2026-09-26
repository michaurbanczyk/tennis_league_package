# Relaksmisja: warunki wpisywania wyniku

Wpisywanie wyniku wymaga przypisania daty, godziny i istniejącego kortu. Dotyczy organizatora, zawodnika i sędziego, również meczu rozpoczętego wcześniej z niekompletnym terminem. Nie ma ograniczenia do bieżącego dnia ani do osiągnięcia planowanej godziny.

Przycisk wpisywania jest zablokowany przy brakujących danych. Edytor wyniku pokazuje komunikat i dla organizatora przycisk uzupełnienia danych meczu. Zmiana harmonogramu podczas otwartej sesji jest uwzględniana przy odświeżaniu danych. Serwer niezależnie od interfejsu odrzuca start/wznowienie, gemy, punkty, zatwierdzenie i cofanie wyniku przy niekompletnym terminie. Zapis częściowych danych meczu i edycja organizatora pozostają dostępne.

Zmiana nie modyfikuje istniejących danych, wyników ani kopii zapasowych. Lokalny przykład demonstracyjny zachowuje dotychczasowe działanie. SmartLiga zachowuje swoje dotychczasowe reguły, a jej deployment nie był zmieniany.

## Sprawdzenie

- `npm run test:schedule-required`: wszystkie wymagane pola, role i operacje wyniku; niezmienność wyniku, historii i rewizji po odrzuconej operacji; uzupełnienie danych i wznowienie wpisywania; stary rozpoczęty mecz; brak zmiany reguł SmartLigi.
- `npm run test:rtl-workflow`: konfiguracja i częściowa edycja, konflikty kortów, drabinka, archiwum i kopie zapasowe.
- `npm run test:seeds`: rozstawienie i awans zawodników, limit 10 terminów oraz kompatybilność kopii.
- Kontrola TypeScript Relaksmisji i produkcyjny build.

Testy API używają izolowanych baz SQLite w pamięci. Nie zmieniano danych produkcyjnych.
