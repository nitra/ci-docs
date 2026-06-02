# Changelog

Усі помітні зміни цього пакета документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).

## [1.2.1] - 2026-06-02

### Fixed

- `sqlToDbml` більше не емітить порожні `Table`-блоки (`Table X {}`) для таблиць, що лишилися без жодної колонки (напр. артефакт `"?column?"` від `CREATE TABLE … AS SELECT`). Симетрично до `sqlToMermaid`. Виправляє невалідний DBML і падіння парсера `code 3018 "A Table must have at least one column"`.

## [1.2.0] - 2026-06-01

### Added

- `sqlToDbml(sql)` — конвертує PostgreSQL DDL (pg_dump `--schema-only`) у **DBML** (`Table` + standalone `Ref:`, підтримка composite PK/FK). При `sqlChanged` `sync-schema` тепер автоматично записує `npm/er/<name>.dbml` поруч із `npm/er/<name>.sql` — готове до перегляду в Azimutt / dbdocs.
- `parseFks` додатково захоплює referenced-колонки (`toCols`).
- `sqlToMermaid(sql)` лишається експортованим (Mermaid `erDiagram`), але в пайплайн більше не підключений.

## [1.1.0] - 2026-06-01

### Added

- `sync-schema` уміє також експортувати **SQL-схему БД** через Hasura pg_dump-ендпоінт і зберігати її у `npm/er/<sql-name>` (default `maya.sql`) — поряд із GraphQL SDL у `npm/schema/`. Вмикається прапором **`--sql`** (за замовчуванням вимкнено, тож наявні `^1.0.0`-споживачі не зачеплені).
- Зміна SQL **або** GraphQL піднімає версію й додає запис у CHANGELOG (SQL — текстовий diff, патч-bump; GraphQL — як раніше через `graphql-inspector`).
- Нові CLI-прапори: `--sql`, `--sql-name`, `--sql-endpoint` (default виводиться з `--endpoint`), `--sql-schema` (default `public`), `--sql-source` (default `default`).
- Експортовані `fetchSql()` та `derivePgDumpEndpoint()`; `main()`/`cli()` повертають додаткові поля `graphqlChanged`/`sqlChanged`, а `GITHUB_OUTPUT` — ключі `graphql-changed`/`sql-changed`.
- ⚠️ Для пушу SQL-файлу додайте його у `--file` кроку `commit-push` (наприклад `--file npm/er/smart.sql`) — інакше зміна версії піде без самого SQL.

### Fixed

- `bin["ci-shared"]` позбувся префікса `./` (`./src/cli.mjs` → `src/cli.mjs`): npm@11 вважав значення з `./` невалідним і вирізав `bin` із опублікованого пакета (`npm warn publish "bin[ci-shared]" script name … was invalid and removed`).

## [1.0.1] - 2026-05-13

### Changed

- `writeGithubOutput()` тепер бере `GITHUB_OUTPUT` через `env` з `node:process` (вимога `n-js-run`).
- JSDoc-описи для helper-функцій у тестах (`setupTmpDocs`, `setupBareDocs`, `startMockGraphql`) — повний набір `@param`/`@returns`.
- `cli.mjs` рефакторено з `process.exit()` на `process.exitCode` (вимога `n-no-process-exit`).

### Added

- `tsconfig.emit-types.json` для генерації `.d.mts` без штучного `src/index.js` (Variant B з `n-npm-module`).
- Локальні регулярки у тестах винесено в module-scope константи (вимога `e18e/prefer-static-regex`).

## [1.0.0] - 2026-05-12

### Added

- CLI `ci-shared sync-schema` — інтроспектить **будь-який** GraphQL-ендпоінт, рахує SemVer-bump через `graphql-inspector`, оновлює CHANGELOG і пише SDL у `npm/schema/`.
  - `--endpoint <url>` (обовʼязковий) — GraphQL-ендпоінт.
  - `--header "K: V"` (повторюваний) — будь-які HTTP-заголовки (Hasura admin secret, Bearer token тощо).
  - `--docs <path>` (default `./docs`), `--schema-name <file>` (default `maya.graphql`), `--source-ref <text>` (default `unknown`).
- CLI `ci-shared commit-push` — git add/commit/push для перелічених файлів.
  - `--repo <path>`, `--message <msg>`, `--file <path>` (повторюваний), `--author-name`, `--author-email` — обовʼязкові.
  - `--branch <name>` (default `main`), `--remote <name>` (default `origin`) — опціональні.
  - Якщо staged-зміни відсутні, ні коміту, ні push не буде.

### Changed

- (BREAKING) Перейменовано CLI-аргументи `sync-schema`: `--hasura-url` → `--endpoint`, `--hasura-secret` → `--header`, `--db-sha` → `--source-ref`.
- (BREAKING) Текст CHANGELOG, що генерується, більше не згадує Hasura: "Оновлено GraphQL-схему (`<ref>`)." та "Початкове додавання GraphQL-схеми.".
- (BREAKING) `main()` та `formatChangelogBlock()` приймають `sourceRef` замість `dbSha`. `fetchSdl(endpoint, headers)` — headers як обʼєкт замість окремого `adminSecret`.
- Видалено CLI-аргумент `--new-schema` зі `sync-schema` (живий ендпоінт — єдина точка входу).
