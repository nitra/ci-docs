/**
 * Converts PostgreSQL DDL (pg_dump --schema-only output) to a Mermaid erDiagram markdown block.
 * @param {string} sql PostgreSQL DDL
 * @returns {string} markdown fenced code block with Mermaid erDiagram
 */
export function sqlToMermaid(sql: string): string
/**
 * Converts PostgreSQL DDL (pg_dump --schema-only output) to DBML.
 * Tables carry `name type [pk]` columns; FKs are emitted as standalone `Ref:` lines.
 * @param {string} sql PostgreSQL DDL
 * @returns {string} DBML document (empty string when no tables)
 */
export function sqlToDbml(sql: string): string
