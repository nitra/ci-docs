import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSchema, graphqlSync } from 'graphql'
import {
  classifyChanges,
  cli,
  derivePgDumpEndpoint,
  formatChangelogBlock,
  main,
  parseHeader,
  prependChangelog,
  runInspector
} from '../../src/sync-schema/main.mjs'

const HEADER = `# Changelog\n\nУсі помітні зміни цього пакета документуються тут.\n\nФормат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).\n\n`
const INVALID_HEADER_REGEX = /Invalid --header/
const OLD_SDL = readFileSync(join(import.meta.dir, '__fixtures__/old-schema.graphql'), 'utf8')
const NEW_SDL = readFileSync(join(import.meta.dir, '__fixtures__/new-schema.graphql'), 'utf8')

describe('classifyChanges', () => {
  it('повертає bump=null коли немає змін', () => {
    expect(classifyChanges([])).toEqual({ bump: null, sections: { added: [], removed: [], changed: [] } })
  })

  it('повертає bump=patch для NON_BREAKING додавань', () => {
    const result = classifyChanges([
      { type: 'FIELD_ADDED', criticality: { level: 'NON_BREAKING' }, message: "Field 'foo' was added to type 'Bar'" }
    ])
    expect(result.bump).toBe('patch')
    expect(result.sections.added).toEqual(["Field 'foo' was added to type 'Bar'"])
  })

  it('повертає bump=minor для будь-якого BREAKING', () => {
    const result = classifyChanges([
      {
        type: 'FIELD_REMOVED',
        criticality: { level: 'BREAKING' },
        message: "Field 'old' was removed from type 'User'"
      },
      { type: 'FIELD_ADDED', criticality: { level: 'NON_BREAKING' }, message: "Field 'new' was added to type 'User'" }
    ])
    expect(result.bump).toBe('minor')
    expect(result.sections.removed).toEqual(["Field 'old' was removed from type 'User'"])
    expect(result.sections.added).toEqual(["Field 'new' was added to type 'User'"])
  })

  it('повертає bump=patch для DANGEROUS', () => {
    const result = classifyChanges([
      {
        type: 'FIELD_ARGUMENT_DEFAULT_CHANGED',
        criticality: { level: 'DANGEROUS' },
        message: "Default for arg 'limit' changed"
      }
    ])
    expect(result.bump).toBe('patch')
    expect(result.sections.changed).toEqual(["Default for arg 'limit' changed"])
  })

  it('класифікує BREAKING модифікації у `changed`', () => {
    const result = classifyChanges([
      { type: 'TYPE_KIND_CHANGED', criticality: { level: 'BREAKING' }, message: "Type 'Foo' changed kind" }
    ])
    expect(result.sections.changed).toEqual(["Type 'Foo' changed kind"])
    expect(result.sections.removed).toEqual([])
  })
})

describe('formatChangelogBlock', () => {
  const baseInput = {
    version: '0.1.0',
    date: '2026-05-11',
    sourceRef: 'db@a1b2c3d',
    sections: { added: [], removed: [], changed: [] }
  }

  it('завжди містить "Changed" з sourceRef', () => {
    const out = formatChangelogBlock(baseInput)
    expect(out).toContain('## [0.1.0] - 2026-05-11')
    expect(out).toContain('### Changed')
    expect(out).toContain('Оновлено GraphQL-схему (`db@a1b2c3d`)')
    expect(out).not.toContain('Hasura')
  })

  it('додає секцію Removed для breaking-видалень', () => {
    const out = formatChangelogBlock({
      ...baseInput,
      sections: { added: [], removed: ["Field 'old' removed"], changed: [] }
    })
    expect(out).toContain('### Removed')
    expect(out).toContain("- Field 'old' removed")
  })

  it('додає секцію Added для non-breaking додавань', () => {
    const out = formatChangelogBlock({
      ...baseInput,
      sections: { added: ["Field 'new' added"], removed: [], changed: [] }
    })
    expect(out).toContain('### Added')
    expect(out).toContain("- Field 'new' added")
  })

  it('не друкує порожні секції', () => {
    const out = formatChangelogBlock(baseInput)
    expect(out).not.toContain('### Added')
    expect(out).not.toContain('### Removed')
  })

  it('first-run шаблон, коли graphqlFirst=true', () => {
    const out = formatChangelogBlock({ ...baseInput, graphqlFirst: true })
    expect(out).toContain('Початкове додавання GraphQL-схеми')
    expect(out).not.toContain('Оновлено GraphQL-схему')
    expect(out).not.toContain('Hasura')
  })

  it('додає рядок про SQL/ER при sqlChanged=true', () => {
    const out = formatChangelogBlock({ ...baseInput, sqlChanged: true })
    expect(out).toContain('Оновлено SQL-схему ER (`db@a1b2c3d`)')
    expect(out).toContain('Оновлено GraphQL-схему (`db@a1b2c3d`)')
  })

  it('first-run SQL: "Початкове додавання SQL-схеми (ER)", без GraphQL-рядка коли GraphQL не змінювався', () => {
    const out = formatChangelogBlock({ ...baseInput, graphqlChanged: false, sqlFirst: true })
    expect(out).toContain('Початкове додавання SQL-схеми (ER)')
    expect(out).not.toContain('Оновлено GraphQL-схему')
  })

  it('закінчується одним порожнім рядком (для коректного prepend)', () => {
    const out = formatChangelogBlock(baseInput)
    expect(out.endsWith('\n\n')).toBe(true)
  })
})

describe('runInspector', () => {
  it('повертає порожній масив для ідентичних схем', async () => {
    const sdl = `type Query { hello: String }`
    const changes = await runInspector(sdl, sdl)
    expect(changes).toEqual([])
  })

  it('детектить BREAKING при видаленні поля', async () => {
    const oldSdl = `type Query { hello: String, bye: String }`
    const newSdl = `type Query { hello: String }`
    const changes = await runInspector(oldSdl, newSdl)
    const breaking = changes.find(c => c.criticality.level === 'BREAKING')
    expect(breaking).toBeDefined()
    expect(breaking.type).toBe('FIELD_REMOVED')
  })

  it('детектить NON_BREAKING при додаванні поля', async () => {
    const oldSdl = `type Query { hello: String }`
    const newSdl = `type Query { hello: String, newField: Int }`
    const changes = await runInspector(oldSdl, newSdl)
    const nb = changes.find(c => c.type === 'FIELD_ADDED')
    expect(nb).toBeDefined()
    expect(nb.criticality.level).toBe('NON_BREAKING')
  })
})

describe('prependChangelog', () => {
  it('вставляє новий блок між хедером і першим існуючим записом', () => {
    const existing = HEADER + '## [0.0.2] - 2026-05-11\n\n### Added\n\n- щось.\n'
    const block = '## [0.0.3] - 2026-05-12\n\n### Changed\n\n- нове.\n\n'
    const out = prependChangelog(existing, block)
    expect(out.indexOf('## [0.0.3]')).toBeLessThan(out.indexOf('## [0.0.2]'))
    expect(out.startsWith('# Changelog')).toBe(true)
  })

  it('додає блок після хедера, якщо записів ще нема', () => {
    const block = '## [0.0.1] - 2026-05-11\n\n### Added\n\n- перший запис.\n\n'
    const out = prependChangelog(HEADER, block)
    expect(out).toBe(HEADER + block)
  })
})

describe('parseHeader', () => {
  it('парсить "Key: Value" → [key, value]', () => {
    expect(parseHeader('X-Hasura-Admin-Secret: super-secret')).toEqual(['X-Hasura-Admin-Secret', 'super-secret'])
  })

  it('обрізає пробіли з обох боків', () => {
    expect(parseHeader('  Authorization  :   Bearer token  ')).toEqual(['Authorization', 'Bearer token'])
  })

  it('зберігає двокрапки у value (Bearer scheme не ламається)', () => {
    expect(parseHeader('Authorization: Bearer abc:def:ghi')).toEqual(['Authorization', 'Bearer abc:def:ghi'])
  })

  it('кидає помилку без двокрапки', () => {
    expect(() => parseHeader('not-a-header')).toThrow(INVALID_HEADER_REGEX)
  })
})

describe('derivePgDumpEndpoint', () => {
  it('замінює /v1/graphql на /v1alpha1/pg_dump', () => {
    expect(derivePgDumpEndpoint('https://api.example.com/v1/graphql')).toBe('https://api.example.com/v1alpha1/pg_dump')
  })

  it('зберігає base-path перед /v1/graphql', () => {
    expect(derivePgDumpEndpoint('https://h.io/hasura/v1/graphql')).toBe('https://h.io/hasura/v1alpha1/pg_dump')
  })

  it('відкидає query та hash', () => {
    expect(derivePgDumpEndpoint('https://h.io/v1/graphql?x=1#frag')).toBe('https://h.io/v1alpha1/pg_dump')
  })

  it('fallback на /v1alpha1/pg_dump, якщо шлях не закінчується /v1/graphql', () => {
    expect(derivePgDumpEndpoint('https://h.io/graphql')).toBe('https://h.io/v1alpha1/pg_dump')
  })
})

describe('main (e2e via fixtures)', () => {
  let tmp

  /**
   * Створює тимчасову docs-директорію з npm/ та опційно старою схемою.
   * @param {object} [options] параметри сетапу
   * @param {boolean} [options.withOldSchema] чи створювати стару схему
   * @param {string} [options.schemaFilename] імʼя файла схеми
   * @returns {{docsRoot: string, npmDir: string}} шляхи створених директорій
   */
  function setupTmpDocs({ withOldSchema = true, schemaFilename = 'maya.graphql' } = {}) {
    tmp = mkdtempSync(join(tmpdir(), 'sync-schema-'))
    const npmDir = join(tmp, 'npm')
    mkdirSync(npmDir, { recursive: true })
    writeFileSync(join(npmDir, 'package.json'), JSON.stringify({ name: '@nitra/efes-docs', version: '0.0.2' }, null, 2))
    writeFileSync(join(npmDir, 'CHANGELOG.md'), HEADER + '## [0.0.2] - 2026-05-10\n\n### Added\n\n- Базовий каркас.\n')
    if (withOldSchema) {
      mkdirSync(join(npmDir, 'schema'), { recursive: true })
      writeFileSync(join(npmDir, 'schema', schemaFilename), OLD_SDL)
    }
    return { docsRoot: tmp, npmDir }
  }

  afterEach(() => {
    if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
  })

  it('BREAKING зміна (видалення поля) → bump minor, CHANGELOG.Removed, schema оновлено', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    const result = await main({ newSdl: NEW_SDL, docsRoot, sourceRef: 'db@abc1234', date: '2026-05-11' })

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('minor')
    expect(result.version).toBe('0.1.0')

    const changelog = readFileSync(join(npmDir, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('## [0.1.0] - 2026-05-11')
    expect(changelog).toContain('### Removed')
    expect(changelog).toContain('deprecated_field')
    expect(changelog).toContain('db@abc1234')
    expect(changelog.indexOf('## [0.1.0]')).toBeLessThan(changelog.indexOf('## [0.0.2]'))

    const schema = readFileSync(join(npmDir, 'schema/maya.graphql'), 'utf8')
    expect(schema).toBe(NEW_SDL)
  })

  it('однакові схеми → changed=false, нічого не записує', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    const result = await main({ newSdl: OLD_SDL, docsRoot, sourceRef: 'db@abc1234', date: '2026-05-11' })

    expect(result.changed).toBe(false)
    expect(result.bump).toBeNull()

    const pkg = JSON.parse(readFileSync(join(npmDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('0.0.2')
  })

  it('first-run (нема старої схеми) → bump patch, CHANGELOG з "Початкове додавання"', async () => {
    const { docsRoot, npmDir } = setupTmpDocs({ withOldSchema: false })
    const result = await main({ newSdl: NEW_SDL, docsRoot, sourceRef: 'db@abc1234', date: '2026-05-11' })

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('patch')
    expect(result.version).toBe('0.0.3')

    const changelog = readFileSync(join(npmDir, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('Початкове додавання GraphQL-схеми')
    expect(existsSync(join(npmDir, 'schema/maya.graphql'))).toBe(true)
  })

  it('кастомний schemaFilename (smart.graphql) — записує саме його', async () => {
    const { docsRoot, npmDir } = setupTmpDocs({ schemaFilename: 'smart.graphql' })
    const result = await main({
      newSdl: NEW_SDL,
      docsRoot,
      sourceRef: 'db@abc1234',
      date: '2026-05-11',
      schemaFilename: 'smart.graphql'
    })

    expect(result.changed).toBe(true)
    expect(existsSync(join(npmDir, 'schema/smart.graphql'))).toBe(true)
    expect(existsSync(join(npmDir, 'schema/maya.graphql'))).toBe(false)
  })

  it('newSql first-run → пише npm/er/maya.sql, sqlChanged, SQL-рядок у CHANGELOG', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    const result = await main({
      newSdl: OLD_SDL, // GraphQL без змін
      newSql: 'CREATE TABLE public.users (id int);\n',
      docsRoot,
      sourceRef: 'db@abc1234',
      date: '2026-05-11'
    })

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('patch')
    expect(result.graphqlChanged).toBe(false)
    expect(result.sqlChanged).toBe(true)

    expect(readFileSync(join(npmDir, 'er/maya.sql'), 'utf8')).toBe('CREATE TABLE public.users (id int);\n')
    const changelog = readFileSync(join(npmDir, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('Початкове додавання SQL-схеми (ER)')
    expect(changelog).not.toContain('Оновлено GraphQL-схему')
  })

  it('SQL не змінився, GraphQL не змінився → changed=false', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    mkdirSync(join(npmDir, 'er'), { recursive: true })
    writeFileSync(join(npmDir, 'er/maya.sql'), 'CREATE TABLE public.users (id int);\n')

    const result = await main({
      newSdl: OLD_SDL,
      newSql: 'CREATE TABLE public.users (id int);\n',
      docsRoot,
      sourceRef: 'db@abc1234',
      date: '2026-05-11'
    })

    expect(result.changed).toBe(false)
    expect(JSON.parse(readFileSync(join(npmDir, 'package.json'), 'utf8')).version).toBe('0.0.2')
  })

  it('GraphQL breaking + SQL змінився → bump minor, обидва файли оновлено', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    mkdirSync(join(npmDir, 'er'), { recursive: true })
    writeFileSync(join(npmDir, 'er/maya.sql'), 'CREATE TABLE public.users (id int);\n')

    const result = await main({
      newSdl: NEW_SDL,
      newSql: 'CREATE TABLE public.users (id int, name text);\n',
      docsRoot,
      sourceRef: 'db@abc1234',
      date: '2026-05-11'
    })

    expect(result.bump).toBe('minor')
    expect(result.graphqlChanged).toBe(true)
    expect(result.sqlChanged).toBe(true)
    expect(readFileSync(join(npmDir, 'schema/maya.graphql'), 'utf8')).toBe(NEW_SDL)
    expect(readFileSync(join(npmDir, 'er/maya.sql'), 'utf8')).toBe('CREATE TABLE public.users (id int, name text);\n')
  })

  it('кастомний sqlFilename — записує саме його', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    await main({
      newSdl: OLD_SDL,
      newSql: 'CREATE TABLE public.t (id int);\n',
      docsRoot,
      sourceRef: 'db@abc1234',
      date: '2026-05-11',
      sqlFilename: 'smart.sql'
    })

    expect(existsSync(join(npmDir, 'er/smart.sql'))).toBe(true)
    expect(existsSync(join(npmDir, 'er/maya.sql'))).toBe(false)
  })
})

describe('cli (тільки args)', () => {
  let tmp
  let server
  let receivedHeaders

  /**
   * Створює мінімальну docs-директорію без схеми для cli-тестів.
   * @returns {string} шлях до docsRoot
   */
  function setupBareDocs() {
    tmp = mkdtempSync(join(tmpdir(), 'sync-schema-cli-'))
    const npmDir = join(tmp, 'npm')
    mkdirSync(npmDir, { recursive: true })
    writeFileSync(join(npmDir, 'package.json'), JSON.stringify({ name: '@nitra/x-docs', version: '0.0.2' }, null, 2))
    writeFileSync(join(npmDir, 'CHANGELOG.md'), HEADER + '## [0.0.2] - 2026-05-10\n\n### Added\n\n- щось.\n')
    return tmp
  }

  /**
   * Стартує локальний mock-сервер: GraphQL-інтроспект на /v1/graphql і Hasura pg_dump на /v1alpha1/pg_dump.
   * @param {string} sdl GraphQL SDL для побудови схеми
   * @param {string} [sql] SQL-дамп, який віддає pg_dump-роут
   * @returns {string} URL GraphQL-ендпоінта запущеного сервера
   */
  function startMockGraphql(sdl, sql = 'CREATE TABLE public.t (id int);\n') {
    const schema = buildSchema(sdl)
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        receivedHeaders = req.headers
        if (new URL(req.url).pathname.endsWith('/v1alpha1/pg_dump')) {
          return new Response(sql, { headers: { 'Content-Type': 'text/plain' } })
        }
        const { query } = await req.json()
        const result = graphqlSync({ schema, source: query })
        return Response.json(result)
      }
    })
    return `http://localhost:${server.port}/v1/graphql`
  }

  afterEach(() => {
    if (server) {
      server.stop()
      server = undefined
    }
    receivedHeaders = undefined
    if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
  })

  it('інтроспектить через --endpoint і синкає схему', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    const result = await cli([
      '--endpoint',
      url,
      '--docs',
      docsRoot,
      '--schema-name',
      'test.graphql',
      '--source-ref',
      'db@abcdef1'
    ])

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('patch')
    expect(existsSync(join(docsRoot, 'npm', 'schema', 'test.graphql'))).toBe(true)
  })

  it('одиничний --header проходить як HTTP-заголовок', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    await cli(['--endpoint', url, '--header', 'X-Hasura-Admin-Secret: super-secret', '--docs', docsRoot])

    expect(receivedHeaders.get('x-hasura-admin-secret')).toBe('super-secret')
  })

  it('кілька --header підтримуються (Authorization + X-Custom)', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    await cli([
      '--endpoint',
      url,
      '--header',
      'Authorization: Bearer abc:def',
      '--header',
      'X-Tenant: org-42',
      '--docs',
      docsRoot
    ])

    expect(receivedHeaders.get('authorization')).toBe('Bearer abc:def')
    expect(receivedHeaders.get('x-tenant')).toBe('org-42')
  })

  it('без --header жодних кастомних заголовків не йде', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    await cli(['--endpoint', url, '--docs', docsRoot])

    expect(receivedHeaders.get('x-hasura-admin-secret')).toBeNull()
    expect(receivedHeaders.get('authorization')).toBeNull()
  })

  it('схема за замовчуванням — maya.graphql', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    await cli(['--endpoint', url, '--docs', docsRoot])

    expect(existsSync(join(docsRoot, 'npm', 'schema', 'maya.graphql'))).toBe(true)
  })

  it('sourceRef за замовчуванням "unknown" і потрапляє в CHANGELOG (не-first-run)', async () => {
    const docsRoot = setupBareDocs()
    // seed old schema so the run isn't a first-run
    mkdirSync(join(docsRoot, 'npm', 'schema'))
    writeFileSync(join(docsRoot, 'npm', 'schema', 'maya.graphql'), OLD_SDL)

    const url = startMockGraphql(NEW_SDL)
    await cli(['--endpoint', url, '--docs', docsRoot])

    const changelog = readFileSync(join(docsRoot, 'npm', 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('(`unknown`)')
  })

  it('за замовчуванням тягне pg_dump і пише npm/er/maya.sql', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL, 'CREATE TABLE public.acc (id int);\n')
    const result = await cli(['--endpoint', url, '--docs', docsRoot])

    expect(result.sqlChanged).toBe(true)
    expect(readFileSync(join(docsRoot, 'npm', 'er', 'maya.sql'), 'utf8')).toBe('CREATE TABLE public.acc (id int);\n')
  })

  it('--skip-sql не тягне pg_dump і не пише SQL-файл', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    const result = await cli(['--endpoint', url, '--docs', docsRoot, '--skip-sql'])

    expect(result.sqlChanged).toBe(false)
    expect(existsSync(join(docsRoot, 'npm', 'er', 'maya.sql'))).toBe(false)
  })

  it('--sql-name кладе дамп у вказаний файл', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockGraphql(NEW_SDL)
    await cli(['--endpoint', url, '--docs', docsRoot, '--sql-name', 'smart.sql'])

    expect(existsSync(join(docsRoot, 'npm', 'er', 'smart.sql'))).toBe(true)
    expect(existsSync(join(docsRoot, 'npm', 'er', 'maya.sql'))).toBe(false)
  })

  it('викидає якщо не передано --endpoint', () => {
    expect(cli(['--docs', join(tmpdir(), 'sync-schema-nowhere')])).rejects.toThrow('--endpoint is required')
  })
})
