import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { buildSchema, buildClientSchema, printSchema, getIntrospectionQuery } from 'graphql'
import { diff } from '@graphql-inspector/core'

const REMOVAL_TYPES = new Set([
  'FIELD_REMOVED',
  'TYPE_REMOVED',
  'ENUM_VALUE_REMOVED',
  'INPUT_FIELD_REMOVED',
  'DIRECTIVE_REMOVED',
  'DIRECTIVE_ARGUMENT_REMOVED',
  'UNION_MEMBER_REMOVED',
  'OBJECT_TYPE_INTERFACE_REMOVED',
  'FIELD_ARGUMENT_REMOVED'
])

const ALLOWED_BUMP_KINDS = new Set(['major', 'minor', 'patch'])

/**
 * Класифікує зміни схеми у секції changelog та визначає тип bump.
 * @param {Array<{type?: string, message: string, criticality?: {level: string}}>} changes масив змін від graphql-inspector
 * @returns {{bump: 'minor'|'patch'|null, sections: {added: string[], removed: string[], changed: string[]}}} тип bump та секції changelog
 */
export function classifyChanges(changes) {
  const sections = { added: [], removed: [], changed: [] }
  let hasBreaking = false
  let hasAnyChange = false

  for (const change of changes) {
    hasAnyChange = true
    const level = change.criticality?.level
    if (level === 'BREAKING') hasBreaking = true

    if (level === 'BREAKING' && REMOVAL_TYPES.has(change.type)) {
      sections.removed.push(change.message)
    } else if (change.type?.endsWith('_ADDED')) {
      sections.added.push(change.message)
    } else {
      sections.changed.push(change.message)
    }
  }

  let bump = null
  if (hasAnyChange) bump = hasBreaking ? 'minor' : 'patch'
  return { bump, sections }
}

/**
 * Будує markdown-блок changelog для версії.
 * @param {{version: string, date: string, sourceRef: string, sections: {added: string[], removed: string[], changed: string[]}, first?: boolean}} params параметри блоку
 * @returns {string} markdown-блок з трейлінговим порожнім рядком
 */
export function formatChangelogBlock({ version, date, sourceRef, sections, first = false }) {
  const lines = [`## [${version}] - ${date}`, '']

  const changed = [...sections.changed]
  if (first) {
    changed.unshift('Початкове додавання GraphQL-схеми.')
  } else {
    changed.unshift(`Оновлено GraphQL-схему (\`${sourceRef}\`).`)
  }

  if (sections.added.length > 0) {
    lines.push('### Added', '')
    for (const item of sections.added) lines.push(`- ${item}`)
    lines.push('')
  }

  lines.push('### Changed', '')
  for (const item of changed) lines.push(`- ${item}`)
  lines.push('')

  if (sections.removed.length > 0) {
    lines.push('### Removed', '')
    for (const item of sections.removed) lines.push(`- ${item}`)
    lines.push('')
  }

  return lines.join('\n') + '\n'
}

/**
 * Обчислює розділювач між існуючим текстом і блоком, що додається.
 * @param {string} existing існуючий вміст
 * @returns {string} '', '\n' або '\n\n' — щоб новий блок починався з відступу одного порожнього рядка
 */
function separatorFor(existing) {
  if (existing.endsWith('\n\n')) return ''
  if (existing.endsWith('\n')) return '\n'
  return '\n\n'
}

/**
 * Вставляє новий блок changelog перед першим існуючим записом (або після хедера, якщо записів нема).
 * @param {string} existing вміст CHANGELOG.md
 * @param {string} newBlock новий блок версії
 * @returns {string} оновлений вміст
 */
export function prependChangelog(existing, newBlock) {
  const firstEntryIdx = existing.indexOf('\n## [')
  if (firstEntryIdx === -1) {
    return existing + separatorFor(existing) + newBlock
  }
  const insertAt = firstEntryIdx + 1
  return existing.slice(0, insertAt) + newBlock + existing.slice(insertAt)
}

/**
 * Запускає graphql-inspector diff між двома SDL.
 * @param {string} oldSdl стара GraphQL-схема (SDL)
 * @param {string} newSdl нова GraphQL-схема (SDL)
 * @returns {Promise<Array<{type: string, message: string, criticality: {level: string}}>>} список змін
 */
export async function runInspector(oldSdl, newSdl) {
  const oldSchema = buildSchema(oldSdl)
  const newSchema = buildSchema(newSdl)
  return await diff(oldSchema, newSchema)
}

/**
 * Читає SDL з файлу або повертає null, якщо файл відсутній/порожній.
 * @param {string} path шлях до SDL
 * @returns {string|null} вміст або null
 */
export function readSdl(path) {
  if (!existsSync(path)) return null
  const content = readFileSync(path, 'utf8')
  return content.trim().length === 0 ? null : content
}

/**
 * Збільшує semver-версію за типом bump.
 * @param {string} version поточна semver-версія (наприклад '0.1.2')
 * @param {'major'|'minor'|'patch'} kind тип bump
 * @returns {string} нова версія
 */
function incrementSemver(version, kind) {
  const parts = version.split('.').map(s => Number.parseInt(s, 10))
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
    throw new Error(`Invalid semver: ${version}`)
  }
  let [major, minor, patch] = parts
  if (kind === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (kind === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
  return `${major}.${minor}.${patch}`
}

/**
 * Підіймає версію у package.json напряму (без виклику зовнішнього `npm`).
 * @param {string} npmDir шлях до директорії пакета
 * @param {'major'|'minor'|'patch'} kind тип bump
 * @returns {string} нова версія
 */
export function bumpVersion(npmDir, kind) {
  if (!ALLOWED_BUMP_KINDS.has(kind)) {
    throw new Error(`Unsupported bump kind: ${kind}`)
  }
  const pkgPath = `${npmDir}/package.json`
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.version = incrementSemver(pkg.version, kind)
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  return pkg.version
}

/**
 * Пише пари key=value у файл, на який вказує `GITHUB_OUTPUT`.
 * @param {Record<string, string>} values пари для запису
 * @returns {void}
 */
export function writeGithubOutput(values) {
  const outPath = process.env.GITHUB_OUTPUT
  if (!outPath) return
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`)
  appendFileSync(outPath, lines.join('\n') + '\n')
}

/**
 * Шле introspection-запит до GraphQL-ендпоінта і повертає SDL-рядок.
 * @param {string} endpoint URL GraphQL-ендпоінта
 * @param {Record<string, string>} [headers] додаткові HTTP-заголовки (наприклад `{ 'X-Hasura-Admin-Secret': '...' }`)
 * @returns {Promise<string>} SDL-схема у вигляді рядка
 */
export async function fetchSdl(endpoint, headers = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query: getIntrospectionQuery() })
  })
  if (!res.ok) throw new Error(`Introspection failed: ${res.status} ${res.statusText}`)
  const { data, errors } = await res.json()
  if (errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`)
  return printSchema(buildClientSchema(data))
}

/**
 * Парсить рядок `Key: Value` у пару `[key, value]`. Помилка, якщо нема `:`.
 * @param {string} raw сирий header
 * @returns {[string, string]} key, value (обрізані з обох боків)
 */
export function parseHeader(raw) {
  const idx = raw.indexOf(':')
  if (idx === -1) throw new Error(`Invalid --header value (expected "Key: Value"): ${raw}`)
  return [raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()]
}

/**
 * Оркеструє весь flow: diff схем → bump → CHANGELOG → запис SDL.
 * @param {{newSdl: string, docsRoot: string, sourceRef: string, date: string, schemaFilename?: string}} params параметри запуску
 * @returns {Promise<{changed: boolean, bump: 'minor'|'patch'|null, version: string|null}>} результат
 */
export async function main({ newSdl, docsRoot, sourceRef, date, schemaFilename = 'maya.graphql' }) {
  const oldSchemaPath = `${docsRoot}/npm/schema/${schemaFilename}`
  const oldSdl = readSdl(oldSchemaPath)

  const first = oldSdl === null
  const changes = first ? [] : await runInspector(oldSdl, newSdl)
  const { bump: classifiedBump, sections } = classifyChanges(changes)
  const bump = first ? 'patch' : classifiedBump

  if (!first && bump === null) {
    return { changed: false, bump: null, version: null }
  }

  const npmDir = `${docsRoot}/npm`
  const version = bumpVersion(npmDir, bump)

  const block = formatChangelogBlock({ version, date, sourceRef, sections, first })
  const changelogPath = `${npmDir}/CHANGELOG.md`
  const existingChangelog = readFileSync(changelogPath, 'utf8')
  writeFileSync(changelogPath, prependChangelog(existingChangelog, block))

  mkdirSync(dirname(oldSchemaPath), { recursive: true })
  writeFileSync(oldSchemaPath, newSdl)

  return { changed: true, bump, version }
}

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
 *
 * @param {string[]} [argv] аргументи (без 'node' та script path). Default — process.argv.slice(2).
 * @returns {Promise<{changed: boolean, bump: string|null, version: string|null}>} результат main()
 */
export async function cli(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      endpoint: { type: 'string' },
      header: { type: 'string', multiple: true, default: [] },
      docs: { type: 'string', default: './docs' },
      'schema-name': { type: 'string', default: 'maya.graphql' },
      'source-ref': { type: 'string', default: 'unknown' }
    },
    allowPositionals: false,
    strict: true
  })

  const endpoint = values.endpoint
  if (!endpoint) {
    throw new Error('--endpoint is required')
  }

  const headers = Object.fromEntries(values.header.map(parseHeader))
  const newSdl = await fetchSdl(endpoint, headers)

  const result = await main({
    newSdl,
    docsRoot: values.docs,
    sourceRef: values['source-ref'],
    date: new Date().toISOString().slice(0, 10),
    schemaFilename: values['schema-name']
  })
  console.log(JSON.stringify(result, null, 2))
  writeGithubOutput({
    changed: String(result.changed),
    bump: result.bump ?? '',
    version: result.version ?? ''
  })
  return result
}
