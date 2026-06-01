---
session: 8e1b459d-0caa-4b86-97da-e60a0d350c96
captured: 2026-06-01T18:06:31+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/8e1b459d-0caa-4b86-97da-e60a0d350c96.jsonl
---

## ADR Міграція downstream-проектів з `@nitra/ci-docs` на `@nitra/ci-shared`

## Context and Problem Statement
Пакет `@nitra/ci-docs` був перейменований на `@nitra/ci-shared`. Downstream-проекти `efes/db` та `abie/db` виклакали пакет через `npx` у workflow-файлах `.github/workflows/sync-schema-to-docs.yml` і продовжували посилатися на стару назву.

## Considered Options
* Замінити `@nitra/ci-docs` на `@nitra/ci-shared` у workflow-файлах обох проектів
* Інші варіанти в transcript не обговорювалися.

## Decision Outcome
Chosen option: "Замінити `@nitra/ci-docs` на `@nitra/ci-shared` у workflow-файлах", because пакет опублікований під новою назвою, а діапазон `@^1.0.0` лишається чинним — автоматично резолвиться в останню 1.x.

### Consequences
* Good, because transcript фіксує очікувану користь: обидва проекти отримують актуальний пакет без зміни діапазону версії.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Змінені файли: `efes/db/.github/workflows/sync-schema-to-docs.yml` (рядки 55, 65), `abie/db/.github/workflows/sync-schema-to-docs.yml` (рядки 47, 57). Заміна виконана через `sed -i ''`. Обидва запушені на гілку `dev` (`efes-cloud/db`, `abinbevefes/db`). ADR-записи в `efes/db/docs/adr/_inbox/` зі згадкою `@nitra/ci-docs` збережено як-є (історичний факт). Реальних залежностей у `package.json` downstream-проектів немає — пакет використовується виключно через `npx`.

---

## ADR Генерація Mermaid ER-діаграми з SQL у `sync-schema`

## Context and Problem Statement
`sync-schema` вже зберігав PostgreSQL DDL (pg_dump `--schema-only`) у `npm/er/<name>.sql`. Виникла потреба мати людиночитаєму ER-діаграму з цього SQL без ручної конвертації.

## Considered Options
* Реалізувати `sqlToMermaid(sql)` у новому модулі `er.mjs` і автоматично генерувати `<name>.md` поруч із `<name>.sql`
* Інші варіанти в transcript не обговорювалися.

## Decision Outcome
Chosen option: "Реалізувати `sqlToMermaid(sql)` у `npm/src/sync-schema/er.mjs`", because це відповідає вже існуючій структурі модуля і не потребує нової CLI-команди — діаграма генерується автоматично при `sqlChanged`.

### Consequences
* Good, because transcript фіксує очікувану користь: при кожній зміні SQL `npm/er/<name>.md` оновлюється автоматично і готовий до рендерингу в GitHub.
* Bad, because transcript не містить підтверджених негативних наслідків.

## More Information
Нові файли: `npm/src/sync-schema/er.mjs` (парсер `CREATE TABLE` + `ALTER TABLE ... FOREIGN KEY` → Mermaid `erDiagram`), `npm/test/sync-schema/er.test.mjs` (8 тестів). Змінено `npm/src/sync-schema/main.mjs` — при `sqlChanged` викликає `sqlToMermaid` і записує `.md` поруч із `.sql`. Версія `npm/package.json` підвищена до `1.2.0`. Виправлено: модуль-рівневі regex-константи для відповідності правилам `e18e/prefer-static-regex` та `sonarjs/slow-regex`, `sonarjs/publicly-writable-directories` у `test/commit-push/main.test.mjs` (pre-existing), jscpd-false-positives через видалення `.claude/worktrees/affectionate-ellis-4b564a`, cspell-словник розширено українськими техтермінами.
