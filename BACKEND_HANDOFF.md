# Przekazanie projektu — FastAPI + PostgreSQL

Aktualizacja: 2026-10-03. Dokument do rozpoczęcia pracy w nowym repozytorium.

## Bieżący priorytet: próba optymalizacji obecnego D1

Przed migracją użytkownik poprosił o ograniczenie przetwarzania całej ligi w
obecnym setupie oraz test na wdrożonym środowisku. Pierwszy krok jest gotowy:
odczyt jednej drabinki i małe odpowiedzi podczas punktacji. Wdrożono go na `rtl`
i sprawdzono na osobnej, następnie usuniętej kategorii testowej.
Opis i ograniczenia: `docs/d1-score-review.md`.
TypeScript, testy regresyjne i test rzeczywistego D1 przeszły.
Migracja FastAPI/PostgreSQL pozostaje osobną propozycją; dalszy krok po przeglądzie.

Najnowsza decyzja: przebudowa w ramach obecnej aplikacji Workers + D1. Użytkownik
zlecił całkowite usunięcie cofania wyniku i sprawdzania maksymalnego czasu meczu.
Krok przygotowano lokalnie; opis: `docs/d1-rebuild-step1.md`. Wymagania undo,
historii i automatycznego wygasania opisane niżej odnoszą się do poprzedniej wersji
i nie są już wymaganiami nowego backendu.

## 1. Aktualna decyzja użytkownika

- **Nowy backend: Python + FastAPI + PostgreSQL.**
- Repozytorium docelowe: `/Users/michal.urbanczyk/Desktop/Others/appscore_be`.
- Dotychczasowa aplikacja i źródło reguł biznesowych:
  `/Users/michal.urbanczyk/Desktop/Others/tennis_league_package`.
- Pracujemy **pojedynczymi krokami, z przeglądem użytkownika po każdym kroku**.
  Przygotować konkretny wynik danego kroku, poprosić o przegląd i poczekać przed kolejnym.
- Najpierw przygotowanie i testy lokalne. Użytkownik wcześniej wskazał Supabase
  PostgreSQL jako bazę wdrożeniową; przy nowym backendzie ponownie potwierdzić tę
  opcję przed konfiguracją hostingu. Hosting samego FastAPI nie został wybrany.
- Aktualna prośba dotyczy zapisania założeń do przeniesienia pracy, nie wdrożenia
  ani uruchomienia migracji produkcyjnej.

Ta decyzja zastępuje wcześniejsze propozycje Hono/Drizzle oraz pozostania przy D1.
Nie rozpoczynać implementacji nowego backendu w repozytorium frontendu.

## 2. Cel i potwierdzony problem

Aplikacja obsługuje turnieje tenisowe, drabinki, planowanie kortów i wyniki na żywo.
Przy tworzeniu wielu kategorii i meczów występowały błędy Cloudflare 1102.

Log wskazywał jednoznacznie:

```text
Worker exceeded CPU time limit.
GET /api/league
worker: rtl
scriptVersion: 7c465117-e6f3-49c9-a04e-f3715cf26829
metadata.id: 01M3Z8JQDC000000000000000S
```

Użytkownik korzystał z Workers Free. Log potwierdza przekroczenie CPU konkretnego
żądania; nie potwierdza przeciążenia D1 ani nie podaje liczby obsługiwanych użytkowników.
Wyniki testów lokalnych nie są dowodem wydajności wdrożenia produkcyjnego.

Przejście na PostgreSQL powinno obejmować zmianę modelu danych i sposobu aktualizacji:
nie przenosić całego obiektu ligi do jednej często nadpisywanej kolumny JSON.

## 3. Stan istniejącej aplikacji

- React/Next.js przez Vinext na Cloudflare Workers.
- D1: `boards` zawiera całą ligę jako JSON, `match_rows` dodatkowe kopie meczów
  i ich rewizje; osobno `sessions` i `attempts`.
- `/api/league` obsługuje większość odczytów i komend, w tym logowanie i archiwa.
- Odczyt ligi może normalizować stany czasowe, zapisywać dane i publikować zmianę.
- Zapis jednego wyniku nadal może nadpisywać całą ligę i ponawiać operację przy
  konflikcie wspólnej rewizji.
- Durable Object rozsyła informację o zmianie. Każda przeglądarka pobiera wtedy
  ponownie całą ligę. Otwarcie strony, socket i odzyskanie fokusu też wywołują odczyt.
- R2 przechowuje pliki, m.in. bannery i ogłoszenia PDF. Trzeba uwzględnić istniejące
  endpointy plików oraz ich autoryzację podczas przenoszenia sesji.

### Pliki referencyjne w starym repozytorium

| Plik                                                    | Co sprawdzić                                           |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `src/app/api/league/route.ts`                           | Obecne komendy, uprawnienia, odpowiedzi i konflikty    |
| `src/lib/tennis.ts`                                     | Punktacja, sety, start/koniec, undo, drabinki i awanse |
| `src/lib/match-timing.ts`                               | Czas rzeczywisty, timer, północ, strefa Europe/Warsaw  |
| `src/lib/schedule-conflicts.ts`                         | Obecna blokada tego samego kortu o tej samej godzinie  |
| `src/lib/court-config.ts`                               | Grupy i konfiguracja kortów                            |
| `src/lib/level-settings.ts`, `src/lib/league-policy.ts` | Walidacja kategorii i dat                              |
| `src/lib/backups.ts`                                    | Format kopii, walidacja i odtwarzanie                  |
| `src/db/schema.ts`, `drizzle/`                          | Obecny schemat D1                                      |
| `src/app/page.tsx`                                      | Wywołania API, sesje, pełne odświeżenia                |
| `src/realtime-room.mjs`, `src/lib/league-updates.ts`    | Powiadomienia live                                     |
| `src/app/api/banners`, `announcements`, `social-links`  | Dodatkowe funkcje API                                  |
| `tests/`, `scripts/test-all.mjs`                        | Przypadki regresyjne do przeniesienia                  |

Nie zakładać, że aktualne pliki lokalne odpowiadają wersji wdrożonej wskazanej w logu.

### Niedokończone zmiany w starym repozytorium

Przed zmianą kierunku pozostała częściowa optymalizacja w:

- `src/app/api/league/route.ts`
- `src/lib/tennis.ts`

Ta wcześniejsza łatka została uwzględniona w bieżącej optymalizacji D1. Błędy
nullable Map-key zostały poprawione; obecny typecheck i testy regresyjne przechodzą.
Przy przenoszeniu reguł sprawdzić też nowe moduły punktacji i opis powyższej próby.

Szkic schematu PostgreSQL w Drizzle został wcześniej usunięty po decyzji o D1.
Nie ma gotowej migracji PostgreSQL do wykorzystania. Bieżąca próba D1 zmieniła
wdrożenie `rtl`, ale nie schemat bazy; dane testowe zostały usunięte.
Nie wykonano prac w `appscore_be` przy tworzeniu tego dokumentu.

## 4. Wymagania funkcjonalne do zachowania

- Turniej/edycja zawiera wiele poziomów lub kategorii; single i deble.
- Drabinki od 1/16 finału: 32 zawodników albo 32 pary w kategorii.
- Awans zwycięzcy, ścieżki przegranego i mecz o trzecie miejsce zgodnie z istniejącymi regułami.
- Format punktacji `super` i `classic`; możliwość ustawienia formatu meczu.
- Rozstawienia, edycja uczestników, konfiguracja i przebudowa drabinek z ochroną
  rozpoczętych spotkań.
- Wspólna pula kortów dla wszystkich kategorii turnieju. W scenariuszu testowym
  **12 kortów łącznie**, nie 12 na kategorię. Liczba konfigurowalna.
- Planowana data/godzina, rzeczywisty start i zakończenie, status meczu.
- Zachować rozróżnienie `startedAt` (wykorzystywanego również jako timer) i
  `actualStartedAt`. Sprawdzić dotychczasowe automatyczne wygasanie stanu live.
- Daty i godziny wyświetlane w Europe/Warsaw; obsłużyć zmianę czasu i przejście
  przez północ. Czas trwania liczony ze znaczników czasu, prezentacja `hh:mm`.
- Start, punkt, zapis setów/wyniku, zakończenie, cofnięcie ostatniej zmiany.
- Oddzielne uprawnienia organizatora, gracza i sędziego; kody meczowe,
  wyłączanie sędziego, rotacja kodów i unieważnianie sesji.
- Archiwa, nowy sezon/edycja, reset, eksport i odtwarzanie kopii.
- Widok kortów na żywo, aktualizacje dla widzów, linki wideo, ustawienia wyglądu i pliki.

Obecna kontrola planu blokuje identyczny kort/datę/godzinę. Pełne wykrywanie
nakładania się przedziałów i konfliktów zawodnika jest rozszerzeniem wymagającym
osobnego ustalenia (np. zakładanego czasu rezerwacji kortu).

## 5. Proponowany stos — do przeglądu w nowym repozytorium

FastAPI i PostgreSQL są wybrane. Pozostałe elementy to propozycja implementacyjna:

- SQLAlchemy 2 jako ORM, Alembic do wersjonowanych migracji.
- Pydantic do kontraktów wejścia/wyjścia i walidacji; osobne modele odpowiedzi publicznych.
- Jeden spójny wariant dostępu do bazy: np. SQLAlchemy async + asyncpg.
  Sesja na żądanie; transakcje kontrolowane w warstwie usług.
- pytest oraz testy integracyjne na rzeczywistym lokalnym PostgreSQL.
- Lokalny PostgreSQL przez Docker Compose, jeżeli Docker jest dostępny.
- Wersje Pythona i zależności wybrać po sprawdzeniu nowego repozytorium i hostingu.

Drizzle, Hono i Hyperdrive nie są wymaganiami backendu FastAPI. Przy zwykłym
serwerze Python połączenia zapewnia pula sterownika/SQLAlchemy, dopasowana do liczby
procesów i limitu połączeń bazy. Użyć standardowego PostgreSQL również lokalnie.

Proponowany podział kodu:

```text
app/
  api/          # endpointy, uwierzytelnianie, odpowiedzi HTTP
  schemas/      # kontrakty Pydantic
  services/     # reguły turniejów, meczów i transakcje
  db/           # modele SQLAlchemy, sesje i zapytania
  jobs/         # zadania czasowe i publikacja zdarzeń
alembic/        # migracje
tests/
```

## 6. Proponowany model danych — nie zatwierdzony schemat SQL

Wspólne tabele z identyfikatorami; nie tworzyć osobnych tabel dla każdego turnieju.

| Tabele / encje                                | Odpowiedzialność                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `tournaments`, `tournament_days`              | Edycja, ustawienia, strefa czasowa, dozwolone daty, archiwizacja           |
| `levels`                                      | Kategorie, single/deble, format, kolejność                                 |
| `players`                                     | Tożsamość zawodnika; imię i nazwisko nie jest unikalnym identyfikatorem    |
| `entries`, `entry_players`                    | Zgłoszenie do kategorii, rozstawienie, jeden zawodnik lub para             |
| `draws`                                       | Konfiguracja i rozmiar drabinki                                            |
| `matches`                                     | Jeden rekord na mecz, harmonogram, status, wynik, własna rewizja           |
| `match_slots`                                 | Dwie strony meczu, zgłoszenie i źródło awansu: zwycięzca/przegrany         |
| `court_groups`, `courts`, `tournament_courts` | Fizyczne korty oraz przydzielenie ich do turniejów                         |
| `match_history`                               | Historia do undo pobierana oddzielnie od zwykłych wyników                  |
| `access_grants`, `sessions`, `login_attempts` | Zakresy uprawnień, sesje, ograniczanie prób logowania                      |
| `outbox_events`                               | Zdarzenia zapisane razem z wynikiem do późniejszej, ponawialnej publikacji |

Mały wynik meczu (sety/punkty/tie-breaki) może pozostać JSONB. Pola używane do
filtrowania i relacje powinny być kolumnami z odpowiednimi kluczami oraz indeksami.
Nie przechowywać całej ligi jako głównego źródła danych w jednym JSONB.

Klucze obce powinny uniemożliwiać przypisanie meczu, uczestnika albo źródła awansu
do niewłaściwej kategorii/turnieju. Relację par należy sprawdzać w usługach.
Kodów i tokenów nie umieszczać w publicznych odpowiedziach. Jeżeli organizator nadal
ma móc odczytać kod, zaplanować szyfrowane przechowywanie niezależnie od jego hasha.

Ustalić przed implementacją: czy gracz może należeć do wielu par w jednej kategorii,
czy logowanie zawsze ma kontekst turnieju, czy organizator zarządza wieloma turniejami
i jak dotychczasowy globalny kod organizatora przełożyć na nowe uprawnienia.

## 7. Proponowane endpointy

Kontrakt trzeba zatwierdzić; poniższa lista wyznacza podział odpowiedzialności.

| Endpoint                                              | Cel                                               |
| ----------------------------------------------------- | ------------------------------------------------- |
| `GET /api/v1/tournaments`                             | Stronicowane podsumowania turniejów               |
| `POST /api/v1/tournaments`                            | Utworzenie turnieju                               |
| `GET/PATCH /api/v1/tournaments/{id}`                  | Odczyt i edycja ustawień                          |
| `GET/POST /api/v1/tournaments/{id}/levels`            | Kategorie                                         |
| `GET/POST /api/v1/levels/{id}/entries`                | Zgłoszenia                                        |
| `POST /api/v1/levels/{id}/draws`                      | Utworzenie drabinki                               |
| `GET /api/v1/draws/{id}`                              | Drabinka wraz z meczami i nazwami uczestników     |
| `GET /api/v1/tournaments/{id}/matches`                | Filtrowanie po statusie, dacie, korcie, kategorii |
| `GET/PATCH /api/v1/matches/{id}`                      | Szczegóły i harmonogram meczu                     |
| `POST /api/v1/matches/{id}/actions`                   | Start, punkt, wynik, zakończenie, undo            |
| `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | Sesje                                             |

Dodatkowo zaprojektować kontrakty archiwizacji, resetu, kopii zapasowych, plików,
zarządzania kodami oraz live. Nie usuwać tych funkcji przy wymianie backendu.

Odczyt drabinki powinien pobierać dane zbiorczo, bez osobnego zapytania HTTP/SQL na
każdy mecz. GET jest odczytem — nie naprawia danych ani nie zapisuje zmian stanów.

## 8. Współbieżność i aktualizacje live

- Rewizja osobno dla meczu; stare żądanie zapisu zwraca HTTP 409.
- Jedna transakcja: zapis wyniku, potrzebne awanse, historia, zdarzenie outbox.
- Blokować tylko potrzebne rekordy w ustalonej kolejności. Równoległe wyniki na
  różnych kortach nie powinny nadpisywać wspólnego obiektu turnieju.
- Operacje tworzenia/importu dzielić na ograniczone porcje i umożliwiać wznowienie
  bez duplikatów. Dla ponawianych komend rozważyć klucze idempotencji.
- Automatyczne przejścia czasowe wykonywać przez trwały harmonogram/zadanie z
  koordynacją między procesami, nie podczas GET ani przez timer każdej przeglądarki.
- Zegar w UI liczy czas ze znaczników; nie wymaga zapisu co sekundę.
- Powiadomienia zawężone do turnieju, ewentualnie kategorii; przesyłać zmienione mecze.
- Po utracie połączenia potrzebny jest bezpieczny odczyt aktualnego stanu.
- Przy wielu procesach FastAPI lokalna lista socketów nie wystarczy do rozsyłania
  zmian. Wybrać wspólny mechanizm publikacji podczas projektowania live.
- Outbox dostarcza zdarzenia co najmniej raz, więc odbiorcy muszą tolerować powtórki.
  UUID, czas utworzenia ani zwykłe ID z sekwencji nie gwarantują kolejności commitów;
  nie budować na nich naiwnego kursora `after`, który może pominąć późniejszy commit.

## 9. Przeniesienie danych i integracja frontendu

- Najpierw inwentaryzacja komend i ustalenie mapowania D1 → PostgreSQL.
- Zachować mapowanie starych identyfikatorów dla linków, archiwów i relacji meczów.
- Nie scalać zawodników po samym nazwisku. Nie zgadywać składu par na podstawie
  niejednoznacznego tekstu; zachować etykietę i raportować potrzebne mapowania.
- Migrować wyniki, źródła awansu, historię, czasy, ustawienia, archiwa i uprawnienia.
- Sesje można unieważnić przy przełączeniu, ale wymaga to jawnej decyzji.
- Zaimportowane dane porównać z eksportem: liczby rekordów, wyniki, relacje, daty,
  uprawnienia. Przetestować backup/restore i przygotować powrót do starego backendu.
- Zdecydować o przejściowym adapterze `/api/league` albo zmianie frontendu na `/api/v1`.
- Przy osobnej domenie API ustalić cookies, CORS i CSRF; unikać dwóch niezależnych
  mechanizmów sesji dla wyników i endpointów plikowych.
- Testy staging przed produkcją. Nie uruchamiać migracji ani testów obciążeniowych
  na stronie użytkownika bez odpowiedniego uzgodnienia zakresu.

## 10. Scenariusz weryfikacji

Dotychczasowy scenariusz demonstracyjny: 15 kategorii, w tym 5 deblowych, po 32
zgłoszenia na kategorię, 240 meczów pierwszej rundy i 12 meczów rozpoczętych na
12 kortach. To 480 zgłoszeń, nie 480 unikalnych osób.

Sprawdzić równoległą pracę 12 edytorów, konflikt tego samego meczu, undo i awans,
ponowione żądania, utratę i odzyskanie połączenia, oraz rosnącą liczbę widzów.
Przykładowe 100/500/1000 widzów to cele testów, a nie obiecana pojemność aplikacji.
Mierzyć opóźnienia, błędy, zapytania i obciążenie bazy, wielkość odpowiedzi i
poprawność zapisanych wyników. Testować również strefę czasową i archiwa.

## 11. Pierwszy krok po otwarciu `appscore_be`

1. Odczytać ten dokument i instrukcje `AGENTS.md` w nowym repozytorium.
2. Sprawdzić istniejące pliki, stan Git i dostępne środowisko, bez nadpisywania pracy.
3. Zaproponować zakres pierwszego kroku: minimalny szkielet FastAPI, lokalny
   PostgreSQL i narzędzia migracji. Jeżeli szkielet już istnieje, dostosować zakres.
4. Wykonać tylko uzgodniony krok, zweryfikować go lokalnie, poprosić o przegląd.
   Nie realizować całej migracji naraz.

### Tekst do rozpoczęcia nowej rozmowy

> Pracujemy w `/Users/michal.urbanczyk/Desktop/Others/appscore_be`.
> Przeczytaj `/Users/michal.urbanczyk/Desktop/Others/tennis_league_package/BACKEND_HANDOFF.md`.
> Budujemy backend FastAPI + PostgreSQL dla istniejącej aplikacji turniejowej.
> Najpierw lokalnie. Pracuj pojedynczymi krokami i po każdym poproś mnie o przegląd.
> Zacznij od sprawdzenia nowego repozytorium i zaproponowania pierwszego kroku.

Dokument nie zawiera haseł, kodów organizatora ani danych dostępowych do usług.
