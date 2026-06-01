---
session: c2a55b2e-d530-46d1-bc1f-2d5e39955c5f
captured: 2026-06-01T16:59:21+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/c2a55b2e-d530-46d1-bc1f-2d5e39955c5f.jsonl
---

## ADR Міграція `@nitra/ci-docs` → `@nitra/ci-shared` у downstream-проєктах

## Context and Problem Statement

Пакет `@nitra/ci-docs` перейменовано на `@nitra/ci-shared` (вже опубліковано версії `1.0.0`/`1.0.1`; локально готується `1.1.0`). Downstream-проєкти `efes/db` і `abie/db` досі посилалися на старий пакет у своїх GitHub Actions workflow.

## Considered Options

- Замінити назву пакета в workflow-файлах зі збереженням того ж семантичного діапазону `^1.0.0`
- Інші варіанти в transcript не обговорювалися.

## Decision Outcome

Chosen option: "Замінити назву пакета в workflow-файлах зі збереженням того ж семантичного діапазону `^1.0.0`", because `@nitra/ci-shared` вже опублікований із сумісним API (`sync-schema`, `commit-push`) під тим самим діапазоном версій, тому мінімальна заміна рядка є достатньою.

### Consequences

- Good, because обидва workflow (`efes/db` і `abie/db`) тепер резолвяться в актуальний пакет `@nitra/ci-shared@^1.0.0` замість застарілого `@nitra/ci-docs`.
- Bad, because transcript не містить підтверджених негативних наслідків.

## More Information

Змінені файли:

- `/Users/vitalii/www/efes/db/.github/workflows/sync-schema-to-docs.yml` (рядки 55, 65)
- `/Users/vitalii/www/abie/db/.github/workflows/sync-schema-to-docs.yml` (рядки 47, 57)

Команда заміни: `sed -i '' 's#@nitra/ci-docs@\^1.0.0#@nitra/ci-shared@^1.0.0#g'`

Замінені виклики: `npx -y @nitra/ci-shared@^1.0.0 sync-schema` та `npx -y @nitra/ci-shared@^1.0.0 commit-push`.

Назва нового пакета підтверджена в `/Users/vitalii/www/nitra/ci-shared/npm/package.json` (`"name": "@nitra/ci-shared"`, `"version": "1.1.0"`). Історичний ADR про створення `@nitra/ci-docs` залишено без змін у `/Users/vitalii/www/efes/db/docs/adr/_inbox/20260513-063838-e8f3b703.md`.
