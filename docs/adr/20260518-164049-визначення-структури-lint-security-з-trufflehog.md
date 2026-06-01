---
session: dedad58b-1d78-4e90-b22e-de3fdc625173
captured: 2026-05-18T16:40:49+03:00
transcript: /Users/vitalii/.claude/projects/-Users-vitalii-www-nitra-ci-shared/dedad58b-1d78-4e90-b22e-de3fdc625173.jsonl
---

NONE

---

TRANSCRIPT END

## ADR Визначення структури `lint-security` з TruffleHog

### Context and Problem Statement

Правило `n-security.mdc` вимагає наявності `lint-security` скрипта, файлу `.trufflehog-exclude` та GitHub Actions workflow. Проєкт не мав жодного з цих артефактів, через що `npx @nitra/cursor check` повертав помилку.

### Considered Options

- Інші варіанти в transcript не обговорювалися.

### Decision Outcome

Chosen option: "Додати `lint-security` через TruffleHog з відповідними артефактами", because правило `n-security.mdc` визначає саме цю структуру як обов'язкову, а `npx @nitra/cursor check` підтвердив відсутність усіх потрібних файлів.

#### Consequences

- Good, because `npx @nitra/cursor check` перейшов у стан `10/10 правил без зауважень`.
- Bad, because transcript не містить підтверджених негативних наслідків.

### More Information

Створені файли: `.trufflehog-exclude`, `.github/workflows/lint-security.yml`. Правило: `.cursor/rules/n-security.mdc`.

---

## ADR Додавання `CHANGELOG.md` для кореневого workspace

### Context and Problem Statement

Правило `n-changelog.mdc` вимагає `CHANGELOG.md` у кожному пакетному workspace. Кореневий workspace (`package.json` з `version: "0.0.1"`) не мав такого файлу, хоча `npm/CHANGELOG.md` існував.

### Considered Options

- Інші варіанти в transcript не обговорювалися.

### Decision Outcome

Chosen option: "Створити `CHANGELOG.md` у корені репозиторію", because `n-changelog.mdc` вимагає окремого changelog для кожного workspace із `package.json`.

#### Consequences

- Good, because transcript фіксує очікувану користь: правило `changelog` пройшло без зауважень після створення файлу.
- Bad, because transcript не містить підтверджених негативних наслідків.

### More Information

Файл: `CHANGELOG.md`. Версія workspace одночасно оновлена з `0.0.1` до `0.0.2` у `package.json`. Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/).

---

## ADR Розширення `.gitignore` для лог-файлів normalize-decisions

### Context and Problem Statement

Хук `normalize-decisions.sh` генерує лог-файл `.claude/hooks/normalize-decisions.log`, аналогічний до вже ігнорованого `capture-decisions.log`. Без відповідного запису у `.gitignore` цей файл потрапляв би до git-дерева.

### Considered Options

- Інші варіанти в transcript не обговорювалися.

### Decision Outcome

Chosen option: "Додати `.claude/hooks/normalize-decisions.log` до `.gitignore`", because файл є технічним артефактом хука і не повинен версіонуватися — за аналогією з уже існуючим записом для `capture-decisions.log`.

#### Consequences

- Good, because лог-файли хуків не потрапляють до git history.
- Bad, because transcript не містить підтверджених негативних наслідків.

### More Information

Файл: `.gitignore`. Хук: `.claude/hooks/normalize-decisions.sh`.
