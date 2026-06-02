---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T19:00:58+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

## ADR SQL-дамп через Hasura pg_dump-ендпоінт як opt-in

## Context and Problem Statement

`sync-schema` вже тягнула GraphQL-схему через introspection Hasura. Виникла потреба також зберігати SQL DDL-схему БД поряд із SDL, щоб downstream-репозиторії мали актуальний дамп без окремого кроку. Питання — звідки брати SQL та як уникнути поломки наявних споживачів.

## Considered Options

- Hasura pg_dump endpoint (`/v1alpha1/pg_dump`)
- Прямий конект до PostgreSQL (JDBC/psql)

## Decision Outcome

Chosen option: "Hasura pg_dump endpoint", because той самий admin-secret уже є в CLI, а прямого конекту до БД з CI може не бути.

### Consequences

- Good, because transcript фіксує очікувану користь: жодних нових секретів і залежностей — лише новий URL, похідний від `--endpoint` (`/v1/graphql` → `/v1alpha1/pg_dump`).
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

`derivePgDumpEndpoint()` у `npm/src/sync-schema/main.mjs`; параметри запиту: `--schema-only`, `clean_output: true` (для стабільного diff). CLI-прапори: `--sql`, `--sql-name`, `--sql-endpoint`, `--sql-schema`, `--sql-source`. SQL зберігається у `npm/er/<name>.sql`.

---

## ADR SQL-експорт як opt-in (прапор `--sql`)

## Context and Problem Statement

Першу реалізацію зроблено як default-on із прапором `--skip-sql`. Після аналізу воркфлоу `abie/db` і `efes/db` виявилось, що наявні споживачі пінять `@^1.0.0`: при виході `1.1.0` вони автоматично отримали б pg_dump-запит і bump версії в CHANGELOG, але SQL-файл у `commit-push --file` не вказано — тобто реліз посилався б на ER-файл, якого немає у docs-репо.

## Considered Options

- Default-on SQL з прапором `--skip-sql` для відмови
- Opt-in SQL з прапором `--sql` (явне ввімкнення)

## Decision Outcome

Chosen option: "Opt-in SQL з прапором `--sql`", because тихий ламаючий ефект для наявних `^1.0.0`-споживачів неприйнятний: pg_dump-запит міг впасти або спровокувати bump без фізичного файлу.

### Consequences

- Good, because transcript фіксує очікувану користь: наявні споживачі без `--sql` працюють як раніше; оновлення явно — у воркфлоу треба додати прапор і `--dir npm/er` у `commit-push`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Зміна відбулась у `npm/src/sync-schema/main.mjs` (блок CLI-аргументів); `--skip-sql` вилучено, `--sql` додано. Воркфлоу `abie/db` і `efes/db` оновлено вручну: `--sql --sql-name smart.sql`/`maya.sql` + `--dir npm/er`.

---

## ADR Спільний version-bump для SQL і GraphQL

## Context and Problem Statement

`sync-schema` вже бампила версію npm-пакету при зміні GraphQL-схеми. Потрібно вирішити, чи змінений SQL також має впливати на версію і запис у CHANGELOG.

## Considered Options

- Так, разом із GraphQL (будь-яка зміна схеми → bump)
- Ні, SQL зберігається без bump

## Decision Outcome

Chosen option: "Так, разом із GraphQL", because user explicitly confirmed це в діалозі вибору.

### Consequences

- Good, because transcript фіксує очікувану користь: docs-репо має семантично версіоновані знімки всієї схеми (і GraphQL, і SQL), і `steps.sync.outputs.changed == 'true'` спрацьовує при зміні будь-якого артефакту.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

`main()` у `npm/src/sync-schema/main.mjs` повертає `graphqlChanged`/`sqlChanged`; `maxBump` обирає найвищий з двох bump-рівнів. SQL-only зміна → patch-bump; GraphQL — як раніше через `graphql-inspector`. У `GITHUB_OUTPUT` виводяться `graphql-changed` і `sql-changed`.

---

## ADR DBML як формат ER-діаграми замість Mermaid і AML

## Context and Problem Statement

При `sqlChanged` потрібно зберігати у docs-репо людиночитаний ER-артефакт для перегляду схеми в інтерактивних інструментах. Обговорювалось три кандидати.

## Considered Options

- Mermaid `erDiagram` (`.md`)
- AML (рідна мова Azimutt)
- DBML (Database Markup Language)

## Decision Outcome

Chosen option: "DBML", because Azimutt CLI виявився інтерактивним (чистить екран, відкриває браузер) і не придатним для CI-пайпів; `sql2dbml` (`@dbml/cli`) зрілий, але потребує зовнішньої залежності, тому реалізовано власний `sqlToDbml()` без залежностей. Mermaid відхилено через нечитабельність на сотнях таблиць і ліміти рендерів GitHub. AML відхилено через молодшу екосистему і відсутність придатного CLI для CI.

### Consequences

- Good, because transcript фіксує очікувану користь: DBML-файл безпосередньо імпортується в Azimutt та dbdocs.io; локальний SVG через `npx @softwaretechnik/dbml-renderer`; `--dir npm/er` у `commit-push` автоматично комітить `.sql` і `.dbml` разом.
- Bad, because `sqlToDbml()` — власна реалізація без підтримки Azimutt (якщо синтаксис DBML зміниться, потребуватиме ручного оновлення).

## More Information

`sqlToDbml()` та `sqlToMermaid()` у `npm/src/sync-schema/er.mjs`; `main.mjs` пише `npm/er/<name>.dbml` при `sqlChanged`. Побіжно виправлено баг `RE_TABLE_BLOCK`: pg_dump береже в лапки зарезервовані назви таблиць (`"user"`, `"order"`), і вони раніше випадали з парсера. Версія npm `1.2.0`.

---

## ADR Підтримка `--dir` у `commit-push`

## Context and Problem Statement

Після додавання генерації `.dbml` поряд із `.sql` у `npm/er/` кожен новий artifact (`.sql`, `.dbml`, потенційно майбутні формати) потребував окремого `--file` у `commit-push`. Перелічення файлів у воркфлоу зросло б з кожним новим форматом.

## Considered Options

- Перераховувати кожен файл окремо через `--file`
- Додати прапор `--dir` для стейджингу цілої директорії

## Decision Outcome

Chosen option: "Додати прапор `--dir`", because `git add` приймає директорії нативно (рекурсивний стейджинг); `--dir npm/er` автоматично захоплює всі нові артефакти без змін у воркфлоу.

### Consequences

- Good, because transcript фіксує очікувану користь: воркфлоу в `abie/db` і `efes/db` не треба чіпати при додаванні нових ER-форматів — `--dir npm/er` покриває їх автоматично.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

`main()` і `cli()` у `npm/src/commit-push/main.mjs`; прапор `--dir` повторюваний (як `--file`); тест: «`--dir` стейджить директорію рекурсивно (всі файли під `npm/er`)». Версія npm `1.2.0`.
