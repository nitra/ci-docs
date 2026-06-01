---
session: c2a55b2e-d530-46d1-bc1f-2d5e39955c5f
captured: 2026-06-01T17:00:32+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/c2a55b2e-d530-46d1-bc1f-2d5e39955c5f.jsonl
---

## ADR Міграція downstream-проєктів з `@nitra/ci-docs` на `@nitra/ci-shared`

## Context and Problem Statement

Пакет `@nitra/ci-docs` було перейменовано на `@nitra/ci-shared` (версія 1.1.0). Downstream-проєкти `efes/db` та `abie/db` продовжували викликати старе ім'я пакета через `npx` у GitHub Actions workflow-файлах `.github/workflows/sync-schema-to-docs.yml`.

## Considered Options

- Замінити `@nitra/ci-docs` на `@nitra/ci-shared` у всіх `npx`-викликах у workflow-файлах downstream-проєктів
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Замінити `@nitra/ci-docs` на `@nitra/ci-shared` у workflow-файлах", because пакет опубліковано під новою назвою (1.0.0, 1.0.1), а `@nitra/ci-docs` більше не підтримується.

Версійний діапазон `^1.0.0` залишено без змін — він резолвиться в останню 1.x, тож після публікації 1.1.0 нова версія підхопиться автоматично. Записи в `docs/adr/_inbox/`, які згадують `@nitra/ci-docs`, не змінювалися — вони є історичними фактами.

### Consequences

- Good, because transcript фіксує очікувану користь: обидва workflow починають викликати актуальний пакет `@nitra/ci-shared`, а не застарілий `@nitra/ci-docs`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Змінені файли:

- `efes/db/.github/workflows/sync-schema-to-docs.yml` — рядки 55, 65 (команди `sync-schema` та `commit-push`)
- `abie/db/.github/workflows/sync-schema-to-docs.yml` — рядки 47, 57 (команди `sync-schema` та `commit-push`)

Команда заміни: `sed -i '' 's#@nitra/ci-docs@\^1.0.0#@nitra/ci-shared@^1.0.0#g'`

Пакет `@nitra/ci-shared` опублікований на момент міграції у версіях 1.0.0 та 1.0.1; версія 1.1.0 готувалася локально в `/Users/vitalii/www/nitra/ci-shared/npm/`.
Зміни закомічено й запушено у гілку `dev` обох репозиторіїв (`efes-cloud/db`, `abinbevefes/db`).
