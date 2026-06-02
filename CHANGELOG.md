# Changelog

Усі помітні зміни цього пакета документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).

## [0.0.4] - 2026-06-02

### Fixed

- `@nitra/ci-shared` піднято до `1.2.1`: `sqlToDbml` більше не емітить порожні `Table`-блоки (фікс невалідного DBML / парсера `code 3018`).

## [0.0.3] - 2026-06-01

### Added

- `.jscpdignore` (`.claude/`, `node_modules/`) — `jscpd` більше не падає на залишкових агент-worktree-копіях під `.claude/worktrees/`.
- Нові словникові статті у `.cspell.json` для термінології sync-schema/SQL/DBML (`bytea`, `macaddr`, `timetz`, `bigserial`, `pathspecs`, `воркфлоу` тощо).

## [0.0.2] - 2026-05-18

### Added

- `lint-image` скрипт (`npx @nitra/minify-image --src=. --write`) та інтеграція в агрегований `lint`.
- `lint-security` скрипт (`trufflehog filesystem …`) і `.trufflehog-exclude` за каноном `n-security`.
- Workflow `.github/workflows/lint-security.yml` для TruffleHog у CI.
- `knip` крок у `scripts.lint-js` та у workflow `lint-js.yml`.
- `.gitignore` ігнорує `.claude/hooks/normalize-decisions.log`.

### Changed

- `scripts.lint-text` — `n-cursor lint-text` (виконує cspell → shellcheck → markdownlint-cli2 → v8r).
- `.cspell.json` ignorePaths поповнено `**/k8s/**/*.yaml` і `*.svg`.
