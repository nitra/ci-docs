---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T18:55:30+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

I'll analyze the transcript and produce MADR-style decision records covering the key design choices made during this session.

---

## ADR SQL-дамп схеми через Hasura pg_dump-ендпоінт

## Context and Problem Statement
У `sync-schema` вже існував flow introspection GraphQL → SDL. Виникла потреба також експортувати SQL-схему БД і зберігати її поряд із GraphQL SDL у docs-репо downstream-проєктів.

## Considered Options
* Hasura pg_dump-ендпоінт (`POST /v1alpha1/pg_dump`, `--schema-only`, `clean_output: true`)
* Прямий конект до PostgreSQL (JDBC/pg-драйвер)

## Decision Outcome
Chosen option: "Hasura pg_dump-ендпоінт", because він уже доступний за тим самим `--endpoint` і `X-Hasura-Admin-Secret`, не вимагає окремого DB-конекту, а `clean_output: true` дає стабільний diff.

### Consequences
* Good, because transcript фіксує очікувану користь: URL pg_dump виводиться автоматично з GraphQL-ендпоінта через `derivePgDumpEndpoint()` (`…/v1/graphql` → `…/v1alpha1/pg_dump`), тому споживачам не потрібні нові credentials.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Реалізовано у `npm/src/sync-schema/main.mjs`: функції `fetchSql()` та `derivePgDumpEndpoint()`. Параметри pg_dump: `schemas: ['public']`, `clean_output: true`, `schema_only: true`.

---

## ADR SQL-експорт як opt-in через прапор `--sql`

## Context and Problem Statement
Після реалізації SQL-дампу стало зрозуміло, що наявні downstream-споживачі (`abie/db`, `efes/db`) пінять `@^1.0.0` і вже мають `commit-push` без `--file npm/er/*.sql`. Якщо SQL тягнеться за замовчуванням — це ламаючий ефект: `changed=true` через SQL→bump+CHANGELOG, але SQL-файл у docs-репо не зʼявляється (не прописаний у `commit-push`).

## Considered Options
* Default-on (SQL тягнеться завжди, `--skip-sql` вимикає)
* Opt-in (`--sql` вмикає, за замовчуванням — лише GraphQL)

## Decision Outcome
Chosen option: "Opt-in (`--sql`)", because існуючі споживачі без `--sql` працюють точно як раніше без жодних змін у їхніх воркфлоу.

### Consequences
* Good, because transcript фіксує очікувану користь: `^1.0.0` → `^1.1.0` не ламає наявні `sync-schema-to-docs.yml` воркфлоу в `abie/db` та `efes/db`.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Прапор `--sql` додано до CLI у `npm/src/sync-schema/main.mjs`. Пов'язані прапори: `--sql-name` (default `maya.sql`), `--sql-endpoint`, `--sql-schema`, `--sql-source`. Воркфлоу-споживачі оновлено: `abie/db/.github/workflows/sync-schema-to-docs.yml`, `efes/db/.github/workflows/sync-schema-to-docs.yml`.

---

## ADR SQL зберігається в директорії `npm/er/`

## Context and Problem Statement
Потрібно визначити, де у docs-репо зберігати SQL-артефакти — поряд із GraphQL SDL (`npm/schema/`) чи в окремій директорії.

## Considered Options
* `npm/er/` (окрема директорія для ER-артефактів)
* Інші варіанти в transcript не обговорювалися.

## Decision Outcome
Chosen option: "`npm/er/`", because користувач явно вказав цей шлях у відповіді на питання «Як зберігати SQL-файл відносно GraphQL-схеми?».

### Consequences
* Good, because transcript фіксує очікувану користь: відокремлення ER-артефактів від GraphQL SDL (`npm/schema/`) дозволяє `commit-push --dir npm/er` комітити всі ER-файли однією командою без перерахування кожного окремо.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Файли: `npm/er/<sql-name>.sql`, `npm/er/<sql-name>.dbml`. У `commit-push` додано прапор `--dir` (повторюваний), що передається в `git add` рекурсивно.

---

## ADR `commit-push` приймає `--dir` як альтернативу до `--file`

## Context and Problem Statement
Після додавання `sqlToDbml` у `sync-schema` крок `commit-push` мав би перелічувати кілька файлів (`*.sql`, `*.dbml`, і потенційно майбутні ER-артефакти) — це крихко і потребує оновлення воркфлоу щоразу, як зʼявляється новий тип файлу.

## Considered Options
* Прапор `--dir` (повторюваний; передається у `git add` як директорія)
* Інші варіанти в transcript не обговорювалися.

## Decision Outcome
Chosen option: "Прапор `--dir`", because `git add` сам рекурсивно стейджить усе в директорії, і воркфлоу залишаються стабільними незалежно від кількості ER-артефактів.

### Consequences
* Good, because transcript фіксує очікувану користь: воркфлоу `abie/db` та `efes/db` тепер використовують `--dir npm/er` замість переліку `--file npm/er/smart.sql --file npm/er/smart.dbml`.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Реалізовано у `npm/src/commit-push/main.mjs`. Тест: `npm/test/commit-push/main.test.mjs` (кейс «`--dir` стейджить директорію рекурсивно»).

---

## ADR Генерація DBML поряд із SQL замість Mermaid `.md`

## Context and Problem Statement
Первісно `sqlToMermaid` генерував Mermaid `erDiagram` у `.md`-файл. Для баз зі сотнями таблиць Mermaid-рендер у GitHub не працює (впирається в ліміти вузлів/ребер), а переглядати такий файл незручно. Постало питання, який формат генерувати поряд із `.sql`.

## Considered Options
* Mermaid `.md` (початковий варіант)
* AML (рідний формат Azimutt)
* DBML (`@dbml/cli`-сумісний формат)

## Decision Outcome
Chosen option: "DBML", because він зрілий (підтримується `sql2dbml` від `@dbml/cli`), широко підтримується за межами Azimutt (dbdocs.io тощо), і Azimutt безпосередньо імпортує DBML.

### Consequences
* Good, because transcript фіксує очікувану користь: DBML є нейтральним interchange-форматом, відкривається в Azimutt drag-n-drop без окремої конвертації.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Реалізовано як `sqlToDbml()` в `npm/src/sync-schema/er.mjs` (reuse `parseTables`/`parseFks`, без зовнішніх залежностей). `sync-schema` пише `npm/er/<name>.dbml` замість `npm/er/<name>.md`. Виявлено і виправлено баг: `RE_TABLE_BLOCK` не розпізнавав quoted-імена таблиць (наприклад `"user"` — зарезервоване слово PostgreSQL).
