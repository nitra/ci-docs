/**
 * Класифікує зміни схеми у секції changelog та визначає тип bump.
 * @param {Array<{type?: string, message: string, criticality?: {level: string}}>} changes масив змін від graphql-inspector
 * @returns {{bump: 'minor'|'patch'|null, sections: {added: string[], removed: string[], changed: string[]}}} тип bump та секції changelog
 */
export function classifyChanges(
  changes: Array<{
    type?: string
    message: string
    criticality?: {
      level: string
    }
  }>
): {
  bump: 'minor' | 'patch' | null
  sections: {
    added: string[]
    removed: string[]
    changed: string[]
  }
}
/**
 * Будує markdown-блок changelog для версії.
 * @param {{version: string, date: string, sourceRef: string, sections: {added: string[], removed: string[], changed: string[]}, graphqlFirst?: boolean, graphqlChanged?: boolean, sqlFirst?: boolean, sqlChanged?: boolean}} params параметри блоку
 * @returns {string} markdown-блок з трейлінговим порожнім рядком
 */
export function formatChangelogBlock({
  version,
  date,
  sourceRef,
  sections,
  graphqlFirst,
  graphqlChanged,
  sqlFirst,
  sqlChanged
}: {
  version: string
  date: string
  sourceRef: string
  sections: {
    added: string[]
    removed: string[]
    changed: string[]
  }
  graphqlFirst?: boolean
  graphqlChanged?: boolean
  sqlFirst?: boolean
  sqlChanged?: boolean
}): string
/**
 * Вставляє новий блок changelog перед першим існуючим записом (або після хедера, якщо записів нема).
 * @param {string} existing вміст CHANGELOG.md
 * @param {string} newBlock новий блок версії
 * @returns {string} оновлений вміст
 */
export function prependChangelog(existing: string, newBlock: string): string
/**
 * Запускає graphql-inspector diff між двома SDL.
 * @param {string} oldSdl стара GraphQL-схема (SDL)
 * @param {string} newSdl нова GraphQL-схема (SDL)
 * @returns {Promise<Array<{type: string, message: string, criticality: {level: string}}>>} список змін
 */
export function runInspector(
  oldSdl: string,
  newSdl: string
): Promise<
  Array<{
    type: string
    message: string
    criticality: {
      level: string
    }
  }>
>
/**
 * Читає SDL з файлу або повертає null, якщо файл відсутній/порожній.
 * @param {string} path шлях до SDL
 * @returns {string|null} вміст або null
 */
export function readSdl(path: string): string | null
/**
 * Підіймає версію у package.json напряму (без виклику зовнішнього `npm`).
 * @param {string} npmDir шлях до директорії пакета
 * @param {'major'|'minor'|'patch'} kind тип bump
 * @returns {string} нова версія
 */
export function bumpVersion(npmDir: string, kind: 'major' | 'minor' | 'patch'): string
/**
 * Пише пари key=value у файл, на який вказує `GITHUB_OUTPUT`.
 * @param {Record<string, string>} values пари для запису
 * @returns {void}
 */
export function writeGithubOutput(values: Record<string, string>): void
/**
 * Шле introspection-запит до GraphQL-ендпоінта і повертає SDL-рядок.
 * @param {string} endpoint URL GraphQL-ендпоінта
 * @param {Record<string, string>} [headers] додаткові HTTP-заголовки (наприклад `{ 'X-Hasura-Admin-Secret': '...' }`)
 * @returns {Promise<string>} SDL-схема у вигляді рядка
 */
export function fetchSdl(endpoint: string, headers?: Record<string, string>): Promise<string>
/**
 * Виводить URL Hasura pg_dump-ендпоінта з GraphQL-ендпоінта.
 * `https://host/v1/graphql` → `https://host/v1alpha1/pg_dump` (query/hash відкидаються).
 * @param {string} graphqlEndpoint URL GraphQL-ендпоінта
 * @returns {string} URL pg_dump-ендпоінта
 */
export function derivePgDumpEndpoint(graphqlEndpoint: string): string
/**
 * Тягне SQL-дамп схеми БД через Hasura pg_dump-ендпоінт і повертає DDL-рядок.
 * @param {string} endpoint URL pg_dump-ендпоінта (наприклад `https://host/v1alpha1/pg_dump`)
 * @param {Record<string, string>} [headers] додаткові HTTP-заголовки (наприклад `{ 'X-Hasura-Admin-Secret': '...' }`)
 * @param {{schema?: string, source?: string}} [opts] `schema` — pg-схема (default 'public'), `source` — Hasura-джерело (default 'default')
 * @returns {Promise<string>} SQL-дамп (schema-only) у вигляді рядка
 */
export function fetchSql(
  endpoint: string,
  headers?: Record<string, string>,
  {
    schema,
    source
  }?: {
    schema?: string
    source?: string
  }
): Promise<string>
/**
 * Парсить рядок `Key: Value` у пару `[key, value]`. Помилка, якщо нема `:`.
 * @param {string} raw сирий header
 * @returns {[string, string]} key, value (обрізані з обох боків)
 */
export function parseHeader(raw: string): [string, string]
/**
 * Оркеструє весь flow: diff схем (GraphQL + SQL/ER) → bump → CHANGELOG → запис SDL/SQL.
 * SQL обробляється, лише якщо передано `newSql` (інакше — як раніше, тільки GraphQL).
 * @param {{newSdl: string, newSql?: string|null, docsRoot: string, sourceRef: string, date: string, schemaFilename?: string, sqlFilename?: string}} params параметри запуску
 * @returns {Promise<{changed: boolean, bump: 'minor'|'patch'|null, version: string|null, graphqlChanged: boolean, sqlChanged: boolean}>} результат
 */
export function main({
  newSdl,
  newSql,
  docsRoot,
  sourceRef,
  date,
  schemaFilename,
  sqlFilename
}: {
  newSdl: string
  newSql?: string | null
  docsRoot: string
  sourceRef: string
  date: string
  schemaFilename?: string
  sqlFilename?: string
}): Promise<{
  changed: boolean
  bump: 'minor' | 'patch' | null
  version: string | null
  graphqlChanged: boolean
  sqlChanged: boolean
}>
/**
 * CLI-обгортка для sync-schema. Приймає параметри як `--key value`.
 *
 * Обовʼязковий:
 *   --endpoint <url>        URL GraphQL-ендпоінта для introspection
 *
 * Необовʼязкові:
 *   --header "K: V"         HTTP-заголовок (повторюваний; наприклад: `--header "X-Hasura-Admin-Secret: ..."`,
 *                           `--header "Authorization: Bearer ..."`)
 *   --docs <path>           корінь docs-репо (default './docs')
 *   --schema-name <file>    назва файлу в `npm/schema/` (default 'maya.graphql')
 *   --source-ref <ref>      текст, що йде у CHANGELOG як посилання на джерело (default 'unknown')
 *   --sql                   увімкнути експорт SQL-дампу через Hasura pg_dump (за замовчуванням вимкнено)
 *   --sql-name <file>       назва SQL-файлу в `npm/er/` (default 'maya.sql'; має сенс лише з --sql)
 *   --sql-endpoint <url>    URL Hasura pg_dump-ендпоінта (default — виводиться з --endpoint)
 *   --sql-schema <name>     pg-схема для дампу (default 'public')
 *   --sql-source <name>     Hasura-джерело для дампу (default 'default')
 * @param {string[]} [argv] аргументи (без 'node' та script path). Default — process.argv.slice(2).
 * @returns {Promise<{changed: boolean, bump: string|null, version: string|null, graphqlChanged: boolean, sqlChanged: boolean}>} результат main()
 */
export function cli(argv?: string[]): Promise<{
  changed: boolean
  bump: string | null
  version: string | null
  graphqlChanged: boolean
  sqlChanged: boolean
}>
