---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T17:35:38+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

<!-- markdownlint-disable MD024 -->

## ADR SQL-схема через Hasura pg_dump-ендпоінт

## Context and Problem Statement

`sync-schema` вже тягнув GraphQL SDL через introspection Hasura-ендпоінта. Виникла потреба також зберігати SQL-схему БД поруч, щоб downstream-репозиторії мали актуальний DDL.

## Considered Options

- Hasura `POST /v1alpha1/pg_dump` з тим самим `X-Hasura-Admin-Secret`
- Прямий конект до PostgreSQL

## Decision Outcome

Chosen option: "Hasura pg_dump endpoint", because користувач обрав цей варіант явно: той самий хост і той самий заголовок автентифікації вже використовуються для GraphQL introspection, тому додаткові credentials не потрібні.

### Consequences

- Good, because `derivePgDumpEndpoint()` автоматично виводить URL pg_dump з GraphQL URL (`.../v1/graphql` → `.../v1alpha1/pg_dump`), тобто споживачі не вказують окремого ендпоінта.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Нові функції: `fetchSql()` (`npm/src/sync-schema/main.mjs`), `derivePgDumpEndpoint()` (`npm/src/sync-schema/main.mjs`). Параметри pg_dump: `--schema-only`, `clean_output: true` для стабільного diff. CLI-прапори: `--sql`, `--sql-name`, `--sql-endpoint`, `--sql-schema`, `--sql-source`.

---

## ADR SQL-експорт як opt-in (`--sql`)

## Context and Problem Statement

Перша реалізація SQL-експорту вмикала pg_dump-запит **за замовчуванням**. Існуючі споживачі (`abie/db`, `efes/db`) пінять `@^1.0.0` і автоматично зарезолвляться у `1.1.0`. Це могло б призвести до того, що pg_dump-запит іде у продакшн без явного вибору, версія бампиться через зміну SQL, але сам SQL-файл не потрапляє в репо (його немає в `--file` commit-push).

## Considered Options

- `--skip-sql` (SQL default-on, можна вимкнути)
- `--sql` (SQL default-off, треба явно ввімкнути)

## Decision Outcome

Chosen option: "`--sql` opt-in", because default-on є фактично ламаючою зміною для існуючих `^1.0.0`-споживачів: pg_dump-запит міг впасти через відмінні права, а bump версії записував би посилання на ER-файл, якого немає в репо.

### Consequences

- Good, because існуючі воркфлоу `abie/db` та `efes/db` без `--sql` продовжують працювати точно як раніше.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Рефактор CLI: `'skip-sql': { type: 'boolean' }` → `'sql': { type: 'boolean' }`. Відповідна умова: `if (values['sql']) { newSql = await fetchSql(...) }`. Тести (`npm/test/sync-schema/main.test.mjs`) оновлено: кейс «за замовчуванням тягне pg_dump» перероблено на явний `--sql`.

---

## ADR SQL і Mermaid ER зберігаються в `npm/er/`

## Context and Problem Statement

GraphQL SDL зберігається в `npm/schema/`. Для SQL DDL і похідної Mermaid ER-діаграми потрібна окрема директорія, щоб не змішувати артефакти різних типів.

## Considered Options

- `npm/er/` (окрема директорія)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "`npm/er/`", because користувач обрав цей варіант явно у відповіді на запитання «Як зберігати SQL-файл відносно GraphQL-схеми?».

### Consequences

- Good, because `sqlToMermaid` автоматично записує `npm/er/<name>.md` поряд із `npm/er/<name>.sql`, і `--dir npm/er` у commit-push закомітить обидва файли одним прапором.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Ім'я SQL-файлу задається `--sql-name` (default `maya.sql`); `.md` виводиться заміною розширення (`name.sql` → `name.md`, `npm/src/sync-schema/main.mjs`). Для `abie`: `npm/er/smart.sql` + `npm/er/smart.md`. Для `efes`: `npm/er/maya.sql` + `npm/er/maya.md`.

---

## ADR `--dir` у commit-push для стейджингу директорій

## Context and Problem Statement

Після додавання `sqlToMermaid` у директорію `npm/er/` потрапляють два файли (`.sql` і `.md`). Перелічувати їх окремо через `--file` незручно і крихко: при появі нових артефактів у директорії воркфлоу треба оновлювати вручну.

## Considered Options

- `--dir <path>` — повторюваний прапор для директорій (git стейджить рекурсивно)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "`--dir <path>`", because `git add` вже рекурсивно стейджить директорії; окремий прапор робить намір явним і дозволяє воркфлоу не перераховувати кожен новий файл усередині `npm/er/`.

### Consequences

- Good, because воркфлоу `abie/db` і `efes/db` замінюють два `--file npm/er/…` на один `--dir npm/er`, і будь-які нові артефакти в цій директорії автоматично потрапляють у коміт.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Змінено `npm/src/commit-push/main.mjs`: `main({ files, dirs })` — обидва масиви передаються в один виклик `git add`. CLI: `'dir': { type: 'string', multiple: true }`. Тест: «`--dir` стейджить директорію рекурсивно» (`npm/test/commit-push/main.test.mjs`). Воркфлоу оновлені: `abie/db` і `efes/db` пінять `@^1.2.0`, використовують `--dir npm/er`.

---

## ADR Зміна SQL враховується у спільному bump версії і CHANGELOG

## Context and Problem Statement

`sync-schema` вже бампив версію пакета і писав CHANGELOG при зміні GraphQL SDL. Після додавання SQL-експорту постало питання, чи впливати SQL-зміні на версію та CHANGELOG.

## Considered Options

- Так, разом із GraphQL — спільний bump
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Так, разом із GraphQL", because користувач обрав цей варіант явно у відповіді на запитання «Чи мають зміни SQL впливати на версію/CHANGELOG?».

### Consequences

- Good, because transcript фіксує очікувану користь: одне місце (CHANGELOG) відображає повний стан синхронізованих артефактів — і GraphQL, і SQL.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

`main()` (`npm/src/sync-schema/main.mjs`) використовує `maxBump(graphqlBump, sqlBump)` для вибору найвищого рівня (major > minor > patch). SQL-зміна без зміни GraphQL дає patch-bump. `steps.sync.outputs` тепер містить окремі `graphql-changed` та `sql-changed` поряд з агрегованим `changed`.
