---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T16:57:22+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

<!-- markdownlint-disable MD024 -->

## ADR SQL-дамп схеми через Hasura pg_dump-ендпоінт

## Context and Problem Statement

Модуль `sync-schema` отримує GraphQL-схему через introspection Hasura-ендпоінта. Виникла потреба також експортувати SQL DDL бази даних. Потрібно було обрати спосіб отримання SQL-схеми.

## Considered Options

- Hasura pg_dump endpoint (`POST /v1alpha1/pg_dump`)
- Прямий конект до PostgreSQL

## Decision Outcome

Chosen option: "Hasura pg_dump endpoint", because цей варіант обрав користувач: ендпоінт уже доступний на тому самому хості Hasura, і той самий `X-Hasura-Admin-Secret` придатний для автентифікації — жодних додаткових облікових даних не потрібно.

### Consequences

- Good, because transcript фіксує очікувану користь: ті самі HTTP-заголовки (`X-Hasura-Admin-Secret`) використовуються і для GraphQL introspection, і для pg_dump — повторне використання конфігурації без змін у CI-секретах.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Ендпоінт виводиться автоматично через `derivePgDumpEndpoint()`: `/v1/graphql` → `/v1alpha1/pg_dump`.
- Параметри запиту: `--schema-only`, `clean_output: true` (для стабільного diff).
- Нові CLI-прапори: `--sql-endpoint`, `--sql-schema` (default `public`), `--sql-source` (default `default`), `--skip-sql`.
- Файл: `npm/src/sync-schema/main.mjs`.

---

## ADR Зберігання SQL-схеми в `npm/er/`

## Context and Problem Statement

GraphQL SDL зберігається в `npm/schema/`. Для SQL DDL потрібно було визначити директорію зберігання всередині npm-пакета.

## Considered Options

- `npm/er/` (кастомна відповідь користувача)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "`npm/er/`", because директорію задав користувач явно під час уточнення вимог.

### Consequences

- Good, because SQL і GraphQL зберігаються у різних директоріях (`npm/er/` vs `npm/schema/`), що дає чітке розділення артефактів.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- CLI-прапор `--sql-name` (default `maya.sql`) задає ім'я файлу всередині `npm/er/`.
- Файл записується лише якщо SQL змінився (аналогічно до GraphQL SDL).
- Файл: `npm/src/sync-schema/main.mjs`.

---

## ADR Спільний version bump і CHANGELOG для GraphQL і SQL

## Context and Problem Statement

До змін `sync-schema` версія і CHANGELOG бампились лише при зміні GraphQL-схеми. З появою SQL-дампу виникло питання: чи мають зміни SQL впливати на версію та CHANGELOG окремо або разом із GraphQL.

## Considered Options

- Спільний bump (будь-яка зміна — GraphQL або SQL — піднімає версію)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Спільний bump", because користувач відповів «Так, разом із GraphQL».

### Consequences

- Good, because transcript фіксує очікувану користь: один запис CHANGELOG і один bump версії навіть коли змінюються обидва артефакти одночасно — уникається подвійний bump за одну операцію sync.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Стратегія bump: зміна SQL → patch; зміна GraphQL → класифікація через `graphql-inspector` (patch/minor/major). Якщо змінились обидва — береться більший (`maxBump()`).
- CHANGELOG-запис включає рядки SQL лише якщо SQL змінився (`sqlLines`), і навпаки для GraphQL.
- `GITHUB_OUTPUT` отримує окремі виходи `graphql-changed` і `sql-changed`.
- `npm/package.json`: версія бампнута `1.0.1 → 1.1.0`.
- Файли: `npm/src/sync-schema/main.mjs`, `npm/CHANGELOG.md`, `npm/package.json`.
