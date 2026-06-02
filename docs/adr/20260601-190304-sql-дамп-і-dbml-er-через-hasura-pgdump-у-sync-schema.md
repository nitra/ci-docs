---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T19:03:04+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

Готово — обидва змерджено й запушено.

## Що стало

```yaml
# abie — було 4 рядки --file/--dir
--dir npm
```

```yaml
# efes — те саме
--dir npm
```

`git add npm` у `commit-push` застейджить рівно те, що змінилось під `npm/`: schema, er, package.json, CHANGELOG.md — жодних зайвих файлів, бо незмінені файли не стейджаться.

Commit-push вже правильно обробляє директорії (ми додали `--dir` підтримку кілька кроків тому).
---

Тепер я маю проаналізувати транскрипт і написати ADR документацію.

## ADR SQL-дамп і DBML-ER через Hasura pg_dump у sync-schema

## Context and Problem Statement
Модуль `sync-schema` зберігав лише GraphQL SDL у `npm/schema/`. Виникла потреба також зберігати SQL-схему БД і ER-діаграму у форматі, зручному для перегляду сотень таблиць через Azimutt — щоб docs-репо містило повну картину бази (DDL + зв'язки).

## Considered Options
* Hasura pg_dump endpoint (`POST /v1alpha1/pg_dump`) для отримання SQL-дампу
* Прямий конект до PostgreSQL (JDBC або інший)
* Зберігати ER у форматі Mermaid `.md`
* Зберігати ER у форматі AML (рідна мова Azimutt)
* Зберігати ER у форматі DBML

## Decision Outcome
Chosen option: "Hasura pg_dump endpoint + DBML", because Hasura pg_dump endpoint дозволяє отримати SQL-дамп, використовуючи вже наявний admin-secret без окремого доступу до БД; DBML обраний замість Mermaid (не масштабується на сотні таблиць у GitHub-рендері) і замість AML (Azimutt CLI виявився інтерактивним — непридатний для CI-пайплайну, DBML ширший за межами Azimutt: dbdocs.io, `@softwaretechnik/dbml-renderer`).

### Consequences
* Good, because transcript фіксує очікувану користь: `.dbml` можна безпосередньо передавати Azimutt (import DBML) або dbdocs.io без додаткових конвертацій.
* Good, because `--sql` як opt-in прапор захищає існуючих споживачів `@^1.0.0` від непередбачуваних побічних ефектів (зайвих pg_dump-запитів або невимушених CHANGELOG-бампів).
* Good, because `--dir npm` у `commit-push` замінює перелік із 4 окремих `--file`/`--dir` параметрів на один, спрощуючи воркфлоу у споживачів.
* Bad, because транскрипт не містить підтверджених негативних наслідків.

## More Information
- `npm/src/sync-schema/er.mjs` — функції `sqlToDbml(sql)`, `parseTables()`, `parseFks()`, `mapType()`; виправлено баг парсера: `RE_TABLE_BLOCK` не розпізнавав pg_dump-quoted-назви таблиць (`"user"`, `"order"`).
- `npm/src/sync-schema/main.mjs` — `fetchSql()`, `derivePgDumpEndpoint()`; CLI-прапори `--sql`, `--sql-name`, `--sql-endpoint`, `--sql-schema`, `--sql-source`; GitHub Output: `sql-changed`, `graphql-changed`.
- `npm/src/commit-push/main.mjs` — додано `--dir` (повторюваний прапор для стейджингу директорій через `git add`).
- Spoживачі: `.github/workflows/sync-schema-to-docs.yml` у `abinbevefes/db` і `efes-cloud/db` — оновлено до `@nitra/ci-shared@^1.2.0`, додано `--sql --sql-name <name>.sql`, `commit-push` замінено на `--dir npm`.
- Pg_dump викликається з `--schema-only` і `clean_output: true` для стабільного diff.
- Версії: `@nitra/ci-shared` `1.0.1 → 1.1.0 → 1.2.0`.
