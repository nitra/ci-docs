---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T18:04:10+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

<!-- markdownlint-disable MD024 -->

## ADR SQL-дамп схеми через Hasura pg_dump-ендпоінт

## Context and Problem Statement

`sync-schema` вже тягнув GraphQL-схему через Hasura introspection; потрібно було додати також PostgreSQL DDL-дамп, щоб зберігати актуальну схему бази даних поруч із GraphQL SDL.

## Considered Options

- Hasura pg_dump endpoint (`POST /v1alpha1/pg_dump`)
- Прямий конект до PostgreSQL

## Decision Outcome

Chosen option: "Hasura pg_dump endpoint", because користувач явно обрав цей варіант під час сесії — ендпоінт уже доступний з тим самим `X-Hasura-Admin-Secret`, що і GraphQL introspection, тож не потрібні окремі credentials.

### Consequences

- Good, because transcript фіксує очікувану користь: один набір заголовків (`X-Hasura-Admin-Secret`) покриває обидва запити — GraphQL introspection і pg_dump.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Ендпоінт виводиться автоматично з `--endpoint`: `derivePgDumpEndpoint()` замінює `/v1/graphql` → `/v1alpha1/pg_dump` зі збереженням base-path (наприклад `/ql`).
- Параметри запиту: `--schema-only`, `clean_output: true` (стабільний diff), схема — `public` (змінюється через `--sql-schema`).
- Реалізовано у `npm/src/sync-schema/main.mjs`: функції `derivePgDumpEndpoint()` і `fetchSql()`.

---

## ADR Зберігання SQL-схеми в `npm/er/` окремо від GraphQL SDL

## Context and Problem Statement

При додаванні SQL-експорту постало питання, куди записувати `.sql`-файл — в уже існуючу директорію `npm/schema/` поруч із `.graphql`, чи в окремий каталог.

## Considered Options

- `npm/er/` — окремий каталог для SQL і ER-матеріалів
- `npm/schema/` — поряд із GraphQL SDL

## Decision Outcome

Chosen option: "`npm/er/`", because користувач явно вказав цей шлях у відповідь на питання «Як зберігати SQL-файл відносно GraphQL-схеми?».

### Consequences

- Good, because `npm/er/` семантично відокремлює ER/SQL-матеріали від GraphQL SDL у `npm/schema/`.
- Good, because transcript фіксує очікувану користь: при додаванні `sqlToMermaid` `.md`-файл природно лягає поруч — `npm/er/<name>.md` — без засмічення `npm/schema/`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Файли: `npm/er/<sql-name>.sql` і `npm/er/<sql-name>.md` (Mermaid ER-діаграма).
- `--dir npm/er` у `commit-push` стейджить обидва файли одночасно.
- CLI-прапор `--sql-name` задає базове ім'я файлу (default `maya.sql`).

---

## ADR SQL-експорт як opt-in (`--sql`) замість opt-out (`--skip-sql`)

## Context and Problem Statement

Початкова реалізація вмикала SQL-fetch за замовчуванням (`--skip-sql` вимикав). Існуючі споживачі (`abie/db`, `efes/db`) пінять `@^1.0.0`, що зарезолвиться у `1.1.0`. Це означало б автоматичний `pg_dump`-запит і можливий падіж CI без явного opt-in.

## Considered Options

- SQL opt-in (`--sql` вмикає)
- SQL opt-out (`--skip-sql` вимикає, default-on)

## Decision Outcome

Chosen option: "SQL opt-in (`--sql` вмикає)", because без цього існуючі воркфлоу `@^1.0.0` одразу отримали б незапитуваний `pg_dump`-запит, потенційний bump версії і CHANGELOG-запис «Оновлено SQL», але без реального запису файлу в репо (бо `commit-push --file` не містив `.sql`).

### Consequences

- Good, because transcript фіксує очікувану користь: `@^1.0.0`-споживачі без `--sql` продовжують працювати точно як раніше.
- Good, because явний `--sql` у воркфлоу є самодокументованим — зрозуміло, що функція увімкнена.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Прапор `--sql` додано до CLI у `npm/src/sync-schema/main.mjs`.
- Супутні прапори: `--sql-name`, `--sql-endpoint`, `--sql-schema`, `--sql-source`.
- Воркфлоу `abie/db` і `efes/db` оновлено: додано `--sql --sql-name smart.sql` / `--sql --sql-name maya.sql`.

---

## ADR Прапор `--dir` у `commit-push` для стейджингу директорії

## Context and Problem Statement

`commit-push` приймав лише `--file` (повторюваний). Після появи `sqlToMermaid` у `npm/er/` лежать два файли (`.sql` + `.md`); перелічувати їх явно в CI — крихко: додавання нового файлу в директорію вимагатиме правки воркфлоу.

## Considered Options

- Новий прапор `--dir` для стейджингу всієї директорії
- Перелічувати кожен файл у `--file` окремо

## Decision Outcome

Chosen option: "Новий прапор `--dir`", because `git add <dir>` рекурсивно стейджить усі файли в директорії — `commit-push` вже делегує `git add`, тож `--dir` не вимагає додаткової логіки, а воркфлоу стає стійким до появи нових файлів у `npm/er/`.

### Consequences

- Good, because transcript фіксує очікувану користь: `--dir npm/er` у CI-кроці commit-push покриває і `.sql`, і `.md` без зміни воркфлоу при розширенні вмісту директорії.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Реалізовано у `npm/src/commit-push/main.mjs`; `main()` приймає `{ files, dirs }`, обидва масиви передаються у `git add`.
- CLI: `--dir` — повторюваний, аналогічно `--file`.
- Воркфлоу `abie/db` і `efes/db` оновлено: `--file npm/er/smart.sql` замінено на `--dir npm/er`.
- Версія пакета піднята до `1.2.0`; пін у воркфлоу — `@^1.2.0`.
