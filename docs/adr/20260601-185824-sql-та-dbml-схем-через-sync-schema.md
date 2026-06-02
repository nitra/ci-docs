---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T18:58:24+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

## ADR SQL та DBML-схем через sync-schema

## Context and Problem Statement
До версії 1.1.0 команда `sync-schema` з `@nitra/ci-shared` тягнула лише GraphQL-схему через introspection і зберігала SDL у `npm/schema/`. Виникла потреба також зберігати SQL-дамп БД і представлення схеми в форматі, зручному для перегляду в Azimutt. Попередньо розглядалися Mermaid `erDiagram` і AML, але було обрано DBML.

## Considered Options
* Mermaid `erDiagram` (`.md`) — першопочатково реалізовано, потім відкинуто
* AML (рідний формат Azimutt) — розглядалося, відкинуто після перевірки CLI
* DBML (`.dbml`) — обрано

## Decision Outcome
Chosen option: "DBML", because `azimutt` CLI є інтерактивним застосунком (не придатним для CI-пайпів), а DBML зріліший за AML — стабільний конвертер `sql2dbml` (@dbml/cli), широка сумісність (Azimutt, dbdocs.io, @softwaretechnik/dbml-renderer), і власна реалізація `sqlToDbml()` в `er.mjs` не потребує зовнішніх залежностей.

### Consequences
* Good, because transcript фіксує очікувану користь: `npm/er/<name>.dbml` автоматично комітиться через `--dir npm/er` у `commit-push`, Azimutt імпортує DBML напряму, і зміна SQL або GraphQL спільно впливає на версію та CHANGELOG.
* Bad, because `--sql` — opt-in прапор (default-off); існуючі споживачі (`abie/db`, `efes/db`) потребують оновлення воркфлоу до `@^1.2.0` та додавання `--sql --sql-name <name>.sql` і `--dir npm/er` у `commit-push`.

## More Information
- `npm/src/sync-schema/er.mjs` — `sqlToDbml()`, `parseTables()`, `parseFks()` (захоплює `toCols` для composite Ref); виправлено баг парсера `RE_TABLE_BLOCK` — pg_dump береже в лапки зарезервовані назви (`"user"`, `"order"`), тепер розпізнаються.
- `npm/src/sync-schema/main.mjs` — `fetchSql()` (POST `v1alpha1/pg_dump`, `--schema-only`, `clean_output:true`), `derivePgDumpEndpoint()` (виводить pg_dump URL з GraphQL URL), запис `npm/er/<name>.sql` + `npm/er/<name>.dbml`.
- `commit-push` отримав `--dir` (повторюваний) — передається у `git add` рекурсивно.
- Нові прапори `cli`: `--sql`, `--sql-name` (default `maya.sql`), `--sql-endpoint`, `--sql-schema`, `--sql-source`.
- Версії: npm `1.0.1 → 1.1.0 → 1.2.0`; root `0.0.2 → 0.0.3`.
- Воркфлоу `abie/db` та `efes/db` оновлено на гілці `chore/sync-sql-dbml` — пін `@^1.2.0`, `--sql --sql-name smart.sql`/`maya.sql`, `--dir npm/er`.
