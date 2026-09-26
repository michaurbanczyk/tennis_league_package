# Niezależne wdrożenia i ochrona danych

## Obecne środowiska

| Aplikacja | Projekt | Adres | Baza |
|---|---|---|---|
| SmartLiga | `appgprj_6ab056e6936c8191adf716fd96f47ed6` | https://smarttenis-live.sss115.chatgpt.site | Własne wiązanie D1 `DB` |
| Relaksmisja | `appgprj_6ab142662f18819197e6291eb738feb4` | https://relaksmisja-live.sss115.chatgpt.site | Własne wiązanie D1 `DB` |

Kod utrzymuje się w jednym neutralnym katalogu/repozytorium `ligi-codebase`. Do dwóch istniejących projektów Sites trafiają osobne, kompletne eksporty. Sites przechowuje historię źródeł każdego wdrożenia oddzielnie; te historie są kopiami wynikowymi, nie dwoma miejscami do ręcznej edycji wspólnego kodu.

## Publikacja przez Sites

1. Przygotuj eksport wybranej ligi. Jeśli aktualizujesz istniejący checkout Sites, najpierw otwórz go standardowym mechanizmem Sites, aby zachować zdalne zmiany.
2. Eksportuj do tego checkoutu. Generator sprawdzi istniejący `project_id` i nie pozwoli pomylić lig.
3. Sprawdź wybraną wersję, zbuduj ją i opublikuj przez Sites, używając jej dotychczasowego projektu.
4. Drugą ligę publikuj osobno, tylko gdy jej aktualizacja jest zamierzona.

Każdy eksport otrzymuje `.league-source.json` z nazwą ligi, tożsamością projektu i sumą kontrolną źródeł. `.openai/hosting.json`, schemat, dotychczasowe migracje i ustawienia sekretów nadal należą do konkretnego wdrożenia. Kod generatora nie odczytuje ani nie zmienia bazy produkcyjnej, sekretów, sesji ani archiwów.

## Dwie własne domeny / inny hosting

Struktura umożliwia dwa niezależne buildy, ale zachowuje istniejący stos: React/Vinext, Cloudflare Worker i D1. To nie jest statyczny plik HTML ani aplikacja przygotowana do zwykłego hostingu PHP.

Na zewnętrznym środowisku należy osobno skonfigurować dwa Workery/usługi, dwie fizyczne bazy D1 lub dostosowane adaptery, dwa zestawy sekretów i dwie domeny. W każdym wdrożeniu lokalna nazwa wiązania może brzmieć `DB`, lecz identyfikator fizycznej bazy musi być inny. W obecnym `vite.config.ts` identyfikator z samych zer jest dotychczasowym placeholderem lokalnym; nie jest bazą produkcyjną. Sites zarządza prawdziwymi wiązaniami podczas publikacji.

Dane przenosi się osobno mechanizmem kopii każdej ligi. Paczka źródłowa i kopie kodu nie zawierają aktualnych wyników, archiwów, kodów dostępu ani sekretów organizatorów. W tej migracji dane pozostają w istniejących bazach.

Nie konfiguruj wspólnego `Domain` dla ciasteczek. Nie kopiuj sekretu organizatora jednej ligi do drugiej. Nie używaj wspólnego katalogu `.wrangler` ani jednego pliku lokalnej bazy dla obu procesów. Domyślne `.generated/smartliga` i `.generated/relaksmisja` mają osobne katalogi robocze.

### Cloudflare Worker Relaksmisji

Samodzielny Worker `relaksmisja` ma adres
`https://relaksmisja.rtlfinals.workers.dev/`. Konfiguracja
`leagues/relaksmisja/modules/wrangler.production.jsonc` wiąże istniejącą bazę
D1 `relaksmisja-production` jako `DB` oraz osobny bucket R2
`relaksmisja-banners` jako `BUCKET`. R2 musi być włączone na koncie Cloudflare;
bucket należy utworzyć przed publikacją. W Workerze ustaw sekret `ADMIN_CODE`
przez Cloudflare Dashboard lub `wrangler secret put`, bez zapisywania go w kodzie.

Po skonfigurowaniu zasobów:

```bash
npm run install:relaksmisja
npm run check:relaksmisja
npm run test:relaksmisja
cd .generated/relaksmisja
node scripts/run-framework.mjs build
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js deploy --config wrangler.production.jsonc
```

Istniejąca baza ma już schemat z `drizzle/0000_equal_photon.sql`. Nie wykonuj
tego pliku ponownie przy aktualizacji Workera. Banery są przechowywane w R2,
więc kopie rozgrywek w D1 ich nie obejmują.

## Powrót do poprzedniej wersji

Przed zmianami wykonano archiwa źródeł obu aplikacji, dołączone w `backups/` wraz z commitami i SHA-256. W Sites można ponownie opublikować poprzednią zapisaną wersję aplikacji. Ponieważ ta migracja nie zmienia schematu ani formatu danych, powrót kodu nie wymaga konwersji baz.

Nie uruchamiaj zerowania ligi, importu cudzej kopii ani nowego sezonu jako kroku migracji kodu. Są to niezależne operacje organizatora, których ta procedura nie potrzebuje.
