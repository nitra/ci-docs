---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T17:26:10+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

<!-- markdownlint-disable MD024 -->

## ADR SQL-схема як opt-in у `sync-schema`

## Context and Problem Statement

Модуль `sync-schema` (@nitra/ci-shared) отримав нову функцію — паралельний експорт SQL-дампу БД поряд із GraphQL SDL. Під час реалізації виявилося, що вмикання SQL за замовчуванням (з прапором `--skip-sql` для відмови) зламає існуючих споживачів, які пінять `@^1.0.0` у GitHub Actions і не додають SQL-файл до `commit-push --file`.

## Considered Options

- SQL вмикається за замовчуванням (`--skip-sql` відмовляє) — початкова реалізація
- SQL opt-in через явний прапор `--sql` — фінальне рішення

## Decision Outcome

Chosen option: "SQL opt-in через явний прапор `--sql`", because існуючі споживачі (наприклад, `nitra/abie-shared`, `nitra/efes-db`) пінять `@^1.0.0` і не мають SQL-файлу в `--file` команди `commit-push`; default-on призвело б до тихого bump версії та запису в CHANGELOG про ER-схему, яка ніколи не потрапила б у репо.

### Consequences

- Good, because transcript фіксує очікувану користь: існуючі воркфлоу не змінюються і не ламаються після апгрейду до `1.1.0`.
- Bad, because нові споживачі мають явно додати `--sql` і `--file npm/er/<sql-name>` у воркфлоу — без цього SQL не збережеться.

## More Information

- Файли змін: `npm/src/sync-schema/main.mjs`, `npm/test/sync-schema/main.test.mjs`, `npm/types/sync-schema/main.d.mts`
- Прапор CLI (фінальний): `--sql` вмикає; `--sql-name` (default `maya.sql`), `--sql-endpoint` (default виводиться з `--endpoint` через `derivePgDumpEndpoint`), `--sql-schema` (`public`), `--sql-source` (`default`)
- SQL зберігається у `npm/er/<sql-name>` (шлях обраний користувачем); GraphQL лишається в `npm/schema/`
- Bump-логіка: зміна SQL дає patch, зміна GraphQL — як раніше через `graphql-inspector`; якщо обидва змінились — `maxBump(graphqlBump, 'patch')`
- `GITHUB_OUTPUT`: додано `graphql-changed` та `sql-changed` поряд із наявним `changed`
- Версія пакета: `1.0.1 → 1.1.0`

---

## ADR Hasura pg_dump як джерело SQL-дампу

## Context and Problem Statement

Для `sync-schema` потрібно було визначити, звідки брати SQL DDL-дамп схеми БД, щоб зберігати його поряд із GraphQL SDL у репо документації.

## Considered Options

- Hasura pg_dump endpoint (`POST /v1alpha1/pg_dump`) — використовує той самий admin-secret
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Hasura pg_dump endpoint", because ендпоінт GraphQL вже є Hasura, той самий `X-Hasura-Admin-Secret` дає доступ — не потрібні окремі DB-credentials у CI.

### Consequences

- Good, because transcript фіксує очікувану користь: `derivePgDumpEndpoint` автоматично виводить URL pg_dump з GraphQL URL (`…/v1/graphql` → `…/v1alpha1/pg_dump`), тому нові споживачі не зобов'язані передавати окремий `--sql-endpoint`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- `fetchSql()` в `npm/src/sync-schema/main.mjs`: `POST /v1alpha1/pg_dump`, параметри `opts: { "clean_output": true }` для стабільного diff, `pg_dump_argv: ["--schema-only", "--schema=<sql-schema>"]`
- `derivePgDumpEndpoint()`: замінює `/v1/graphql` → `/v1alpha1/pg_dump` в URL
- `--sql-source` (default `default`) та `--sql-schema` (default `public`) передаються в тіло запиту
