# Changelog

Усі помітні зміни цього пакета документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).

## [1.1.0] - 2026-06-01

### Added

- `sync-schema` тепер також експортує **SQL-схему БД** через Hasura pg_dump-ендпоінт і зберігає її у `npm/er/<sql-name>` (default `maya.sql`) — поряд із GraphQL SDL у `npm/schema/`.
- Зміна SQL **або** GraphQL піднімає версію й додає запис у CHANGELOG (SQL — текстовий diff, патч-bump; GraphQL — як раніше через `graphql-inspector`).
- Нові CLI-прапори: `--sql-name`, `--sql-endpoint` (default виводиться з `--endpoint`), `--sql-schema` (default `public`), `--sql-source` (default `default`), `--skip-sql`.
- Експортовані `fetchSql()` та `derivePgDumpEndpoint()`; `main()`/`cli()` повертають додаткові поля `graphqlChanged`/`sqlChanged`, а `GITHUB_OUTPUT` — ключі `graphql-changed`/`sql-changed`.

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
