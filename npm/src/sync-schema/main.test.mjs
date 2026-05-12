import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSchema, graphqlSync } from 'graphql'
import { classifyChanges, cli, formatChangelogBlock, main, prependChangelog, runInspector } from './main.mjs'

const HEADER = `# Changelog\n\nУсі помітні зміни цього пакета документуються тут.\n\nФормат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/), нумерація — [SemVer](https://semver.org/lang/uk/).\n\n`
const OLD_SDL = readFileSync(join(import.meta.dir, '__fixtures__/old-schema.graphql'), 'utf8')
const NEW_SDL = readFileSync(join(import.meta.dir, '__fixtures__/new-schema.graphql'), 'utf8')
const NEW_SCHEMA_PATH = join(import.meta.dir, '__fixtures__/new-schema.graphql')

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
      { type: 'FIELD_REMOVED', criticality: { level: 'BREAKING' }, message: "Field 'old' was removed from type 'User'" },
      { type: 'FIELD_ADDED', criticality: { level: 'NON_BREAKING' }, message: "Field 'new' was added to type 'User'" }
    ])
    expect(result.bump).toBe('minor')
    expect(result.sections.removed).toEqual(["Field 'old' was removed from type 'User'"])
    expect(result.sections.added).toEqual(["Field 'new' was added to type 'User'"])
  })

  it('повертає bump=patch для DANGEROUS', () => {
    const result = classifyChanges([
      { type: 'FIELD_ARGUMENT_DEFAULT_CHANGED', criticality: { level: 'DANGEROUS' }, message: "Default for arg 'limit' changed" }
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
  const baseInput = { version: '0.1.0', date: '2026-05-11', dbSha: 'a1b2c3d', sections: { added: [], removed: [], changed: [] } }

  it('завжди містить "Changed" з посиланням на db-SHA', () => {
    const out = formatChangelogBlock(baseInput)
    expect(out).toContain('## [0.1.0] - 2026-05-11')
    expect(out).toContain('### Changed')
    expect(out).toContain('Оновлено GraphQL-схему з Hasura (`db@a1b2c3d`)')
  })

  it('додає секцію Removed для breaking-видалень', () => {
    const out = formatChangelogBlock({ ...baseInput, sections: { added: [], removed: ["Field 'old' removed"], changed: [] } })
    expect(out).toContain('### Removed')
    expect(out).toContain("- Field 'old' removed")
  })

  it('додає секцію Added для non-breaking додавань', () => {
    const out = formatChangelogBlock({ ...baseInput, sections: { added: ["Field 'new' added"], removed: [], changed: [] } })
    expect(out).toContain('### Added')
    expect(out).toContain("- Field 'new' added")
  })

  it('не друкує порожні секції', () => {
    const out = formatChangelogBlock(baseInput)
    expect(out).not.toContain('### Added')
    expect(out).not.toContain('### Removed')
  })

  it('first-run шаблон, коли first=true', () => {
    const out = formatChangelogBlock({ ...baseInput, first: true })
    expect(out).toContain('Початкове додавання GraphQL-схеми')
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

describe('main (e2e via fixtures)', () => {
  let tmp

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
    const result = await main({ newSdl: NEW_SDL, docsRoot, dbSha: 'abc1234567', date: '2026-05-11' })
    console.log(JSON.stringify(result, null, 2))

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('minor')
    expect(result.version).toBe('0.1.0')

    const changelog = readFileSync(join(npmDir, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('## [0.1.0] - 2026-05-11')
    expect(changelog).toContain('### Removed')
    expect(changelog).toContain('deprecated_field')
    expect(changelog.indexOf('## [0.1.0]')).toBeLessThan(changelog.indexOf('## [0.0.2]'))

    const schema = readFileSync(join(npmDir, 'schema/maya.graphql'), 'utf8')
    expect(schema).toBe(NEW_SDL)
  })

  it('однакові схеми → changed=false, нічого не записує', async () => {
    const { docsRoot, npmDir } = setupTmpDocs()
    const result = await main({ newSdl: OLD_SDL, docsRoot, dbSha: 'abc1234567', date: '2026-05-11' })
    console.log(JSON.stringify(result, null, 2))

    expect(result.changed).toBe(false)
    expect(result.bump).toBeNull()

    const pkg = JSON.parse(readFileSync(join(npmDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('0.0.2')
  })

  it('first-run (нема старої схеми) → bump patch, CHANGELOG з "Початкове додавання"', async () => {
    const { docsRoot, npmDir } = setupTmpDocs({ withOldSchema: false })
    const result = await main({ newSdl: NEW_SDL, docsRoot, dbSha: 'abc1234567', date: '2026-05-11' })
    console.log(JSON.stringify(result, null, 2))

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('patch')
    expect(result.version).toBe('0.0.3')

    const changelog = readFileSync(join(npmDir, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('Початкове додавання GraphQL-схеми')
    expect(existsSync(join(npmDir, 'schema/maya.graphql'))).toBe(true)
  })

  it('кастомний schemaFilename (smart.graphql) — записує саме його', async () => {
    const { docsRoot, npmDir } = setupTmpDocs({ schemaFilename: 'smart.graphql' })
    const result = await main({ newSdl: NEW_SDL, docsRoot, dbSha: 'abc1234567', date: '2026-05-11', schemaFilename: 'smart.graphql' })

    expect(result.changed).toBe(true)
    expect(existsSync(join(npmDir, 'schema/smart.graphql'))).toBe(true)
    expect(existsSync(join(npmDir, 'schema/maya.graphql'))).toBe(false)
  })
})

describe('cli (тільки args)', () => {
  let tmp
  let server
  let receivedHeaders

  function setupBareDocs() {
    tmp = mkdtempSync(join(tmpdir(), 'sync-schema-cli-'))
    const npmDir = join(tmp, 'npm')
    mkdirSync(npmDir, { recursive: true })
    writeFileSync(join(npmDir, 'package.json'), JSON.stringify({ name: '@nitra/x-docs', version: '0.0.2' }, null, 2))
    writeFileSync(join(npmDir, 'CHANGELOG.md'), HEADER + '## [0.0.2] - 2026-05-10\n\n### Added\n\n- щось.\n')
    return tmp
  }

  function startMockHasura(sdl) {
    const schema = buildSchema(sdl)
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        receivedHeaders = req.headers
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

  it('інтроспектить Hasura через --hasura-url і синкає схему', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockHasura(NEW_SDL)
    const result = await cli(['--hasura-url', url, '--docs', docsRoot, '--schema-name', 'test.graphql', '--db-sha', 'abcdef1234'])

    expect(result.changed).toBe(true)
    expect(result.bump).toBe('patch')
    expect(existsSync(join(docsRoot, 'npm', 'schema', 'test.graphql'))).toBe(true)
  })

  it('передає --hasura-secret як X-Hasura-Admin-Secret заголовок', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockHasura(NEW_SDL)
    await cli(['--hasura-url', url, '--hasura-secret', 'super-secret', '--docs', docsRoot])

    expect(receivedHeaders.get('x-hasura-admin-secret')).toBe('super-secret')
  })

  it('без --hasura-secret заголовок не надсилається', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockHasura(NEW_SDL)
    await cli(['--hasura-url', url, '--docs', docsRoot])

    expect(receivedHeaders.get('x-hasura-admin-secret')).toBeNull()
  })

  it('схема за замовчуванням — maya.graphql', async () => {
    const docsRoot = setupBareDocs()
    const url = startMockHasura(NEW_SDL)
    await cli(['--hasura-url', url, '--docs', docsRoot])

    expect(existsSync(join(docsRoot, 'npm', 'schema', 'maya.graphql'))).toBe(true)
  })

  it('викидає якщо не передано ні --new-schema ні --hasura-url', () => {
    expect(cli(['--docs', '/tmp/nowhere'])).rejects.toThrow('--new-schema or --hasura-url is required')
  })

  it('викидає якщо передано обидва --new-schema і --hasura-url', () => {
    expect(cli(['--new-schema', '/tmp/a.graphql', '--hasura-url', 'http://x'])).rejects.toThrow(
      '--new-schema and --hasura-url are mutually exclusive'
    )
  })

  it('запускає main через --new-schema (без мережі)', async () => {
    const docsRoot = setupBareDocs()
    const result = await cli(['--new-schema', NEW_SCHEMA_PATH, '--docs', docsRoot, '--schema-name', 'file.graphql', '--db-sha', 'deadbeef'])
    expect(result.changed).toBe(true)
    expect(existsSync(join(docsRoot, 'npm', 'schema', 'file.graphql'))).toBe(true)
  })
})
