# Przebudowa obecnej aplikacji — krok 4

Zakres do przeglądu: użycie wydzielonych endpointów odczytu w interfejsie.

- Wybranie pojedynczego poziomu w widoku drabinek pobiera go przez
  `GET /api/levels/{levelId}/draw`.
- Otwarcie edycji lub panelu wyniku meczu pobiera ten mecz przez
  `GET /api/matches/{matchId}`.
- Odpowiedź jest stosowana tylko wtedy, gdy jej rewizja ligi zgadza się z aktualną
  rewizją strony. W razie rozbieżności strona odświeża pełny stan, by uniknąć
  połączenia danych z różnych wersji.
- Ekran startowy i aktualizacje live nadal korzystają z `GET /api/league`.

## Weryfikacja

- `npm run check` — poprawnie.
- `npm run build` — poprawnie; pozostało ostrzeżenie bundlera o dużym bundlu
  klienta.
- Nie wykonano testów ani wdrożenia.
