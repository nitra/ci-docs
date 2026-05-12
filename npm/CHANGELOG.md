# Changelog

Усі помітні зміни цього пакета документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).

## [0.0.2] - 2026-05-12

### Added

- CLI `ci-docs` з subcommand `sync-schema` — інтроспектить Hasura, рахує SemVer-bump, оновлює CHANGELOG і пише SDL у `npm/schema/`.
- Аргументи (тільки `--key value`, без env-vars):
  - `--hasura-url <url>` (обовʼязковий) — GraphQL-ендпоінт для introspection.
  - `--hasura-secret <value>` — значення `X-Hasura-Admin-Secret` (опціонально для публічних ендпоінтів).
  - `--docs <path>` — корінь docs-репо (default `./docs`).
  - `--schema-name <file>` — назва SDL-файлу в `npm/schema/` (default `maya.graphql`).
  - `--db-sha <sha>` — SHA коміту db для запису в CHANGELOG (default `unknown`).
