const PG_MERMAID = new Map([
  ['integer', 'int'],
  ['bigint', 'int'],
  ['smallint', 'int'],
  ['serial', 'int'],
  ['bigserial', 'int'],
  ['oid', 'int'],
  ['boolean', 'boolean'],
  ['bool', 'boolean'],
  ['real', 'float'],
  ['float4', 'float'],
  ['float8', 'float'],
  ['text', 'string'],
  ['uuid', 'string'],
  ['ltree', 'string'],
  ['inet', 'string'],
  ['cidr', 'string'],
  ['macaddr', 'string'],
  ['jsonb', 'json'],
  ['json', 'json'],
  ['bytea', 'bytes'],
  ['date', 'date'],
  ['xml', 'string'],
  ['money', 'decimal']
])

// eslint-disable-next-line sonarjs/slow-regex -- not ReDoS-vulnerable: [^)] is a simple negated class
const RE_PARENS = /\([^)]*\)/g
const RE_TABLE_BLOCK = /CREATE TABLE\s+(?:"?\w+"?\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gm
const RE_TRAILING_COMMA = /,$/
const RE_PK_CONSTRAINT = /^CONSTRAINT\s+\S+\s+PRIMARY KEY\s*\(([^)]+)\)/i
const RE_CONSTRAINT_LINE = /^(?:CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|LIKE)\s/i
const RE_CONSTRAINT_WORD = /^(?:CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|LIKE)$/i
const RE_COL_NAME = /^"?(\w+)"?\s+/
// eslint-disable-next-line sonarjs/slow-regex -- not ReDoS-vulnerable: split position is fixed by keyword boundaries
const RE_TYPE_END = /\s+(?:NOT\s+NULL|DEFAULT|GENERATED|CHECK)\b/i
// eslint-disable-next-line sonarjs/slow-regex -- not ReDoS-vulnerable: \S+ is possessive in V8
const RE_FK_BLOCK =
  /ALTER TABLE\s+(?:ONLY\s+)?(\S+)\s+ADD CONSTRAINT\s+\S+\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+(\S+)\s*\(([^)]+)\)/gm
const RE_QUOTED = /"/g
const RE_SCHEMA_PREFIX = /^\w+\./
const RE_ID_PLAIN = /^[a-zA-Z_]\w*$/

/**
 * Maps a raw PostgreSQL column type to a Mermaid-friendly type name.
 * @param {string} raw raw PostgreSQL type (e.g. `character varying(255)`)
 * @returns {string} normalized Mermaid type (e.g. `string`)
 */
function mapType(raw) {
  const t = raw.toLowerCase().replaceAll(RE_PARENS, '').trim()
  if (t === 'double precision' || t === 'float8') return 'float'
  if (t.startsWith('timestamp') || t === 'timetz') return 'datetime'
  if (t.startsWith('time ') || t === 'time') return 'time'
  if (t.startsWith('character varying') || t.startsWith('varchar')) return 'string'
  if (t.startsWith('character') || t === 'char') return 'string'
  if (t.startsWith('numeric') || t.startsWith('decimal')) return 'decimal'
  if (t.startsWith('interval') || t.startsWith('bit')) return 'string'
  return PG_MERMAID.get(t) ?? 'string'
}

/**
 * @param {string} line trimmed line without trailing comma
 * @returns {{ pk: true, cols: string[] } | { pk: false, name: string, type: string } | null} parsed PK constraint, column, or null to skip
 */
function parseBodyLine(line) {
  if (!line || line.startsWith('--')) return null
  const pkMatch = line.match(RE_PK_CONSTRAINT)
  if (pkMatch) {
    return { pk: true, cols: pkMatch[1].split(',').map(c => c.trim().replaceAll(RE_QUOTED, '')) }
  }
  if (RE_CONSTRAINT_LINE.test(line)) return null
  const nameMatch = line.match(RE_COL_NAME)
  if (!nameMatch) return null
  const name = nameMatch[1]
  if (RE_CONSTRAINT_WORD.test(name)) return null
  const rest = line.slice(nameMatch[0].length)
  const typeStr = rest.split(RE_TYPE_END)[0].trim()
  return { pk: false, name, type: mapType(typeStr) }
}

/**
 * Parses `CREATE TABLE` blocks into a map of table name → columns.
 * @param {string} sql PostgreSQL DDL
 * @returns {Map<string, Array<{name: string, type: string, pk: boolean, fk: boolean}>>} table name → columns with pk/fk flags
 */
function parseTables(sql) {
  const tables = new Map()
  for (const m of sql.matchAll(RE_TABLE_BLOCK)) {
    const name = m[1]
    const pks = new Set()
    const cols = []
    for (const rawLine of m[2].split('\n')) {
      const line = rawLine.trim().replace(RE_TRAILING_COMMA, '').trim()
      const parsed = parseBodyLine(line)
      if (!parsed) continue
      if (parsed.pk) {
        for (const c of parsed.cols) pks.add(c)
      } else {
        cols.push({ name: parsed.name, type: parsed.type, pk: false, fk: false })
      }
    }
    for (const col of cols) if (pks.has(col.name)) col.pk = true
    tables.set(name, cols)
  }
  return tables
}

/**
 * Parses `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` blocks into FK relations.
 * @param {string} sql PostgreSQL DDL
 * @returns {Array<{fromTable: string, fromCols: string[], toTable: string, toCols: string[]}>} FK relations with source and referenced columns
 */
function parseFks(sql) {
  const splitCols = raw => raw.split(',').map(c => c.trim().replaceAll(RE_QUOTED, ''))
  const fks = []
  for (const m of sql.matchAll(RE_FK_BLOCK)) {
    const fromTable = m[1].replace(RE_SCHEMA_PREFIX, '').replaceAll(RE_QUOTED, '')
    const toTable = m[3].replace(RE_SCHEMA_PREFIX, '').replaceAll(RE_QUOTED, '')
    fks.push({ fromTable, fromCols: splitCols(m[2]), toTable, toCols: splitCols(m[4]) })
  }
  return fks
}

/**
 * @param {Map<string, Array<{name: string, type: string, pk: boolean, fk: boolean}>>} tables table map (mutated in place)
 * @param {Array<{fromTable: string, fromCols: string[], toTable: string}>} fks FK relations
 * @returns {void}
 */
function markFkCols(tables, fks) {
  for (const { fromTable, fromCols } of fks) {
    const cols = tables.get(fromTable)
    if (!cols) continue
    for (const col of cols) {
      if (fromCols.includes(col.name)) col.fk = true
    }
  }
}

/**
 * @param {string} name table name
 * @param {Array<{name: string, type: string, pk: boolean, fk: boolean}>} cols column list
 * @returns {string[]} lines for one Mermaid entity block
 */
function tableBlock(name, cols) {
  const lines = [`    ${name} {`]
  for (const col of cols) {
    const flags = [col.pk && 'PK', col.fk && 'FK'].filter(Boolean).join(',')
    lines.push(`        ${col.type} ${col.name}${flags ? ' ' + flags : ''}`)
  }
  lines.push('    }')
  return lines
}

/**
 * Converts PostgreSQL DDL (pg_dump --schema-only output) to a Mermaid erDiagram markdown block.
 * @param {string} sql PostgreSQL DDL
 * @returns {string} markdown fenced code block with Mermaid erDiagram
 */
export function sqlToMermaid(sql) {
  const tables = parseTables(sql)
  const fks = parseFks(sql)
  markFkCols(tables, fks)

  const lines = ['erDiagram']
  for (const [name, cols] of tables) {
    if (cols.length > 0) lines.push(...tableBlock(name, cols))
  }
  for (const { fromTable, toTable, fromCols } of fks) {
    if (!tables.has(fromTable) || !tables.has(toTable)) continue
    lines.push(`    ${toTable} ||--o{ ${fromTable} : "${fromCols[0]}"`)
  }

  return '```mermaid\n' + lines.join('\n') + '\n```\n'
}

/**
 * Escapes a DBML identifier (double-quotes it when it has characters outside `[A-Za-z0-9_]`).
 * @param {string} id raw identifier
 * @returns {string} bare or double-quoted identifier
 */
function dbmlId(id) {
  return RE_ID_PLAIN.test(id) ? id : `"${id}"`
}

/**
 * Renders one side of a DBML `Ref` (single column `t.c`, composite `t.(a, b)`).
 * @param {string} table table name
 * @param {string[]} cols column names
 * @returns {string} DBML ref endpoint
 */
function dbmlRefEndpoint(table, cols) {
  const colPart = cols.length === 1 ? dbmlId(cols[0]) : `(${cols.map(dbmlId).join(', ')})`
  return `${dbmlId(table)}.${colPart}`
}

/**
 * Converts PostgreSQL DDL (pg_dump --schema-only output) to DBML.
 * Tables carry `name type [pk]` columns; FKs are emitted as standalone `Ref:` lines.
 * @param {string} sql PostgreSQL DDL
 * @returns {string} DBML document (empty string when no tables)
 */
export function sqlToDbml(sql) {
  const tables = parseTables(sql)
  const fks = parseFks(sql)

  const blocks = []
  for (const [name, cols] of tables) {
    const lines = [`Table ${dbmlId(name)} {`]
    for (const col of cols) lines.push(`  ${dbmlId(col.name)} ${col.type}${col.pk ? ' [pk]' : ''}`)
    lines.push('}')
    blocks.push(lines.join('\n'))
  }

  const refs = []
  for (const { fromTable, fromCols, toTable, toCols } of fks) {
    if (!tables.has(fromTable) || !tables.has(toTable)) continue
    refs.push(`Ref: ${dbmlRefEndpoint(fromTable, fromCols)} > ${dbmlRefEndpoint(toTable, toCols)}`)
  }
  if (refs.length > 0) blocks.push(refs.join('\n'))

  return blocks.length > 0 ? blocks.join('\n\n') + '\n' : ''
}
