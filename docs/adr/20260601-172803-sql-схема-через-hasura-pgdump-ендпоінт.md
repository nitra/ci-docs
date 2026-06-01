---
session: 5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8
captured: 2026-06-01T17:28:03+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/5c3ab1c7-b4e8-42aa-8c36-a0786ff6b3b8.jsonl
---

<!-- markdownlint-disable MD024 -->

## ADR SQL-схема через Hasura pg_dump-ендпоінт

## Context and Problem Statement

Модуль `sync-schema` вже тягнув GraphQL-схему через Hasura introspection. Виникла потреба також зберігати SQL-дамп схеми БД поряд із GraphQL SDL, щоб downstream-репозиторії мали повну структуру даних.

## Considered Options

- Hasura pg_dump-ендпоінт (`POST /v1alpha1/pg_dump`)
- Прямий конект до PostgreSQL

## Decision Outcome

Chosen option: "Hasura pg_dump-ендпоінт", because це логічно і consistent: той самий хост і ті самі заголовки (`X-Hasura-Admin-Secret`), що вже використовуються для GraphQL introspection. Користувач вибрав цей варіант явно під час сесії.

### Consequences

- Good, because не потрібні додаткові секрети або інфраструктурний доступ до PostgreSQL — все через той самий Hasura-ендпоінт.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- `derivePgDumpEndpoint()` виводить URL `…/v1alpha1/pg_dump` з `…/v1/graphql`, зберігаючи base-path.
- Параметри запиту: `--schema-only`, `clean_output: true` (для стабільного diff), `pg_dump_args: ['--schema=public']`.
- Файл: `npm/src/sync-schema/main.mjs`, функції `derivePgDumpEndpoint` та `fetchSql`.

---

## ADR Зберігання SQL у `npm/er/` поряд із GraphQL SDL

## Context and Problem Statement

Потрібно визначити, куди в структурі npm-пакета зберігати SQL-дамп схеми БД, щоб він логічно розмежовувався з GraphQL SDL.

## Considered Options

- `npm/er/` (окрема директорія для ER/SQL-схем)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "`npm/er/`", because користувач вказав цей шлях явно у відповіді на питання «Як зберігати SQL-файл відносно GraphQL-схеми?».

### Consequences

- Good, because transcript фіксує очікувану користь: SQL і GraphQL розмежовані по директоріях (`npm/schema/` vs `npm/er/`), що спрощує пошук та `--file`-перелік у `commit-push`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- GraphQL SDL зберігається в `npm/schema/<schema-name>.graphql` (без змін).
- SQL зберігається в `npm/er/<sql-name>.sql`, де `--sql-name` задає ім'я файлу (default `maya.sql`).
- У `commit-push` споживачі мають явно додати `--file npm/er/<sql-name>.sql`.

---

## ADR Зміни SQL впливають на версію та CHANGELOG разом із GraphQL

## Context and Problem Statement

Потрібно визначити, чи повинна зміна SQL-дампу ініціювати bump SemVer-версії пакета та запис у CHANGELOG, і якщо так — разом із GraphQL чи незалежно.

## Considered Options

- Так, разом із GraphQL (один спільний bump на run)
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Так, разом із GraphQL", because користувач підтвердив це явно. SQL-зміна дає patch-bump; GraphQL-зміна — як раніше (через `graphql-inspector`). Якщо обидва змінились — береться вищий з двох рівнів (`maxBump`).

### Consequences

- Good, because transcript фіксує очікувану користь: `steps.sync.outputs.changed` стає `true` навіть при зміні лише SQL, тому `commit-push`-крок спрацьовує коректно; в CHANGELOG зʼявляється єдиний запис, що відображає обидва артефакти.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- `GITHUB_OUTPUT` тепер містить `graphql-changed` та `sql-changed` окремо, крім `changed`.
- Функція `maxBump()` у `npm/src/sync-schema/main.mjs` реалізує порівняння рівнів.

---

## ADR SQL-експорт як opt-in (`--sql`) замість default-on

## Context and Problem Statement

Початкова реалізація вмикала SQL-fetch за замовчуванням (`--skip-sql` для вимкнення). Але існуючі споживачі (`abie/db`, `efes/db`) пінять `@^1.0.0` — при виході `1.1.0` вони б зарезолвили нову версію і отримали мовчазний ламаючий ефект: pg_dump-запит, зміна CHANGELOG-версії, але SQL-файл не закомітиться (бо `--file npm/er/…` відсутній у їхніх `commit-push`-кроках).

## Considered Options

- SQL opt-in через `--sql` (default-off)
- SQL default-on із `--skip-sql` для вимкнення

## Decision Outcome

Chosen option: "SQL opt-in через `--sql`", because існуючі споживачі з `^1.0.0` не мають `--file npm/er/…` у `commit-push`, тому default-on мовчки генерував би SQL і відображав його зміни у CHANGELOG, але ніколи не пушив файл у репо. Opt-in гарантує backward-compatibility: без `--sql` поведінка ідентична `1.0.x`.

### Consequences

- Good, because існуючі воркфлоу (`abie/db`, `efes/db`) не змінюють поведінки без явного `--sql` і `--file npm/er/…` у `commit-push`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

- Прапор `--sql` вмикає fetch; `--sql-name`, `--sql-endpoint`, `--sql-schema`, `--sql-source` уточнюють параметри.
- Споживачі, що хочуть SQL, мають додати `--sql --sql-name <name>.sql` до `sync-schema` і `--file npm/er/<name>.sql` до `commit-push`, а також підняти пін до `@^1.1.0`.
- Воркфлоу оновлено в: `/Users/vitalii/www/abie/db/.github/workflows/sync-schema-to-docs.yml`, `/Users/vitalii/www/efes/db/.github/workflows/sync-schema-to-docs.yml`.
