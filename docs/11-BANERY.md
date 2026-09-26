# Banery Relaksmisji

Po zalogowaniu organizatora: sam dół strony, pod sponsorami → Banery strony. Dwa oddzielne pliki PNG/JPG, do 2 MB:
- Baner ligi: 1200 × 420 px. Zastępuje logo/nazwę w górnym nagłówku, także w TV; nie obejmuje menu ani przycisków.
- Baner sponsorów: 2400 × 600 px. Zastępuje domyślną siatkę 18 logotypów pod stopką. Widoczny we wszystkich zwykłych zakładkach i archiwum. Nie jest renderowany w TV.

Wybór pliku → walidacja wymiarów/formatu/rozmiaru → podgląd → Zapisz baner. Dostępne pobranie bieżącego banera oraz przywrócenie domyślnego. Wybranie pliku bez zapisania nie wpływa na publikację. Obrazy zachowują proporcje i skalują się do szerokości strony. Zmiany dla innych otwartych stron są pobierane co 30 sekund oraz po powrocie do okna.

## Dane i niezależność

Funkcja istnieje wyłącznie w module Relaksmisji. Jej manifest dodaje własny binding R2 BUCKET; SmartLiga pozostaje bez R2, bez tych tras i bez zmian wdrożenia. Banery są globalne dla danej aplikacji, więc nowy sezon, usunięcie archiwum lub przywrócenie danych sezonu ich nie zmienia. Obrazy są przechowywane w R2 pod dwoma stałymi kluczami, bez zmian schematu D1 i bez dodawania plików do cyklicznych odpowiedzi z wynikami. Sesja organizatora sprawdzana po stronie serwera. Warunkowy zapis ETag chroni przed równoczesnym nadpisaniem. Brak uploadów anonimowych i zawodników/sędziów. Nie ma synchronizacji z inną ligą.

Dotychczasowa kopia JSON rozgrywek działa bez zmian i nie obejmuje globalnych grafik. Do kopii grafik służą przyciski „Pobierz kopię banera” (PNG/JPG), również do późniejszego ponownego przesłania. Informacja jest widoczna w panelu.

## Sprawdzenie

`npm run test:banners`: role i wygasłe sesje; dwa niezależne banery; format, wymiary i limit; odrzucenie nieprawidłowych żądań; równoczesny zapis; pobieranie; awaria magazynu; przywrócenie domyślnego; brak zmiany SmartLigi. Kontrola TypeScript i produkcyjny build Relaksmisji. W przeglądarce: wybór PNG, podgląd i odrzucenie nieodpowiednich wymiarów; obecność sponsorów na tablicy, planie i wynikach live, brak w TV. Sprawdzano na lokalnym podglądzie; danych produkcyjnych nie zmieniano.
