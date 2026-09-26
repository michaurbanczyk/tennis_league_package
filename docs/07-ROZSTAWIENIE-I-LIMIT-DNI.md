# Rozstawienie i limit terminów — Relaksmisja

W „Edytuj mecz” przy każdym zawodniku (lub parze deblowej) pierwszej rundy pojawił się opcjonalny wybór rozstawienia. Opcja „Bez rozstawienia” jest domyślna; numer można dodać, zmienić lub usunąć. Zakres wynosi 1–2, 1–4, 1–8 lub 1–16, zgodnie z wielkością pierwszej rundy danego poziomu. Numery nie mogą powtarzać się pomiędzy uczestnikami tego samego poziomu. Ustawienie rozstawienia nie przestawia par ani meczów.

Numer prezentowany jest jako „Jan Kowalski [1]” w publicznej drabince, kartach wyników i harmonogramu, wyszukiwaniu, wynikach na żywo oraz widoku TV. Nazwisko w danych pozostaje bez dopisku; rozstawienie jest osobnym opcjonalnym polem. Potencjalny uczestnik bezpośrednio następnej rundy również pokazuje numer. Awans przenosi numer zwycięzcy, a mecz o trzecie miejsce — przegranego. Cofnięcie wyniku usuwa rozstawienie z nierozstrzygniętego miejsca w kolejnej rundzie. Edycja numeru w pierwszej rundzie aktualizuje dalsze mecze.

Nowa konfiguracja sezonu i edycja ustawień finałów dopuszczają 1–10 dat. Limit jest sprawdzany także po stronie API. Istniejące dane i historyczne kopie z większą liczbą dat nie są obcinane ani kasowane; przejście na limit wymaga wyboru maksymalnie 10 terminów i wcześniejszego przeniesienia meczów z usuwanych dat.

Kopie Relaksmisji mają teraz wersję 3, żeby starszy kod nie przywracał ich z pominięciem rozstawienia. Import poprzednich wersji 1 i 2 jest zachowany. Rozstawienie pozostaje w archiwach i kopiach zapasowych. SmartLiga zachowuje dotychczasowy interfejs i format kopii v1; nie została ponownie wdrożona.

## Sprawdzenie

- `test:seeds`: opcjonalne numery, zakresy 2/4/8/16, unikalność, uprawnienia, publiczne dane, drabinka, awans zwycięzcy i przegranego, poprawianie i usuwanie numeru, cofanie wyniku, archiwa i kopie v3, zgodność kopii v1/v2 oraz limit 10 dni dla zapisu i nowego sezonu.
- Test przepływu Relaksmisji, testy drabinek i kopii obu lig, kontrola TypeScript obu wariantów — pozytywne.
- Osobne budowanie Relaksmisji przed publikacją. Nie powtarzano pełnego długiego zestawu testów ani nie edytowano produkcyjnych meczów.
