import { describe, it, expect } from 'bun:test'
import { sqlToDbml, sqlToMermaid } from '../../src/sync-schema/er.mjs'

const RE_MERMAID_START = /^```mermaid\n/
const RE_MERMAID_END = /\n```\n$/

const SIMPLE_SQL = `
CREATE TABLE public.role (
    id integer NOT NULL,
    name text NOT NULL,
    CONSTRAINT role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user (
    id integer NOT NULL,
    name text NOT NULL,
    role_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT user_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.user
    ADD CONSTRAINT user_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
`

describe('sqlToMermaid', () => {
  it('produces a fenced mermaid block', () => {
    const out = sqlToMermaid(SIMPLE_SQL)
    expect(out).toMatch(RE_MERMAID_START)
    expect(out).toMatch(RE_MERMAID_END)
    expect(out).toContain('erDiagram')
  })

  it('maps PK columns', () => {
    const out = sqlToMermaid(SIMPLE_SQL)
    expect(out).toContain('int id PK')
  })

  it('maps FK columns', () => {
    const out = sqlToMermaid(SIMPLE_SQL)
    expect(out).toContain('int role_id FK')
  })

  it('maps type variants correctly', () => {
    const out = sqlToMermaid(SIMPLE_SQL)
    expect(out).toContain('string name')
    expect(out).toContain('datetime created_at')
    expect(out).toContain('boolean deleted')
    expect(out).toContain('json settings')
  })

  it('emits FK relation line', () => {
    const out = sqlToMermaid(SIMPLE_SQL)
    expect(out).toContain('role ||--o{ user : "role_id"')
  })

  it('returns minimal erDiagram for empty sql', () => {
    expect(sqlToMermaid('')).toBe('```mermaid\nerDiagram\n```\n')
  })

  it('handles multicolumn PK and numeric types', () => {
    const sql = `
CREATE TABLE public.order_line (
    order_id integer NOT NULL,
    line_no smallint NOT NULL,
    qty numeric(10,2) NOT NULL,
    price double precision,
    CONSTRAINT order_line_pkey PRIMARY KEY (order_id, line_no)
);
`
    const out = sqlToMermaid(sql)
    expect(out).toContain('int order_id PK')
    expect(out).toContain('int line_no PK')
    expect(out).toContain('decimal qty')
    expect(out).toContain('float price')
  })

  it('skips FK relation when referenced table is absent', () => {
    const sql = `
CREATE TABLE public.child (
    id integer NOT NULL,
    parent_id integer,
    CONSTRAINT child_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.child
    ADD CONSTRAINT child_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parent(id);
`
    const out = sqlToMermaid(sql)
    expect(out).not.toContain('||--o{')
  })
})

describe('sqlToDbml', () => {
  it('emits Table blocks with typed columns and pk', () => {
    const out = sqlToDbml(SIMPLE_SQL)
    expect(out).toContain('Table role {\n  id int [pk]\n  name string\n}')
    expect(out).toContain('Table user {')
    expect(out).toContain('  role_id int\n')
    expect(out).toContain('  created_at datetime\n')
  })

  it('emits standalone Ref line for FK (src > ref)', () => {
    const out = sqlToDbml(SIMPLE_SQL)
    expect(out).toContain('Ref: user.role_id > role.id')
  })

  it('does not mark FK column as pk', () => {
    const out = sqlToDbml(SIMPLE_SQL)
    expect(out).not.toContain('role_id int [pk]')
  })

  it('returns empty string for empty sql', () => {
    expect(sqlToDbml('')).toBe('')
  })

  it('skips Ref when referenced table is absent', () => {
    const sql = `
CREATE TABLE public.child (
    id integer NOT NULL,
    parent_id integer,
    CONSTRAINT child_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.child
    ADD CONSTRAINT child_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parent(id);
`
    const out = sqlToDbml(sql)
    expect(out).not.toContain('Ref:')
    expect(out).toContain('Table child {\n  id int [pk]')
  })

  it('marks every column of a composite PK', () => {
    const sql = `
CREATE TABLE public.order_line (
    order_id integer NOT NULL,
    line_no smallint NOT NULL,
    qty numeric(10,2) NOT NULL,
    CONSTRAINT order_line_pkey PRIMARY KEY (order_id, line_no)
);
`
    const out = sqlToDbml(sql)
    expect(out).toContain('  order_id int [pk]')
    expect(out).toContain('  line_no int [pk]')
    expect(out).toContain('  qty decimal')
  })

  it('parses quoted reserved-word table names (pg_dump quotes "user")', () => {
    const sql = `
CREATE TABLE public."user" (
    id integer NOT NULL,
    role_id integer,
    CONSTRAINT user_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role (
    id integer NOT NULL,
    CONSTRAINT role_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);
`
    const out = sqlToDbml(sql)
    expect(out).toContain('Table user {')
    expect(out).toContain('Ref: user.role_id > role.id')
  })

  it('renders composite FK with parenthesized column lists', () => {
    const sql = `
CREATE TABLE public.parent (
    a integer NOT NULL,
    b integer NOT NULL,
    CONSTRAINT parent_pkey PRIMARY KEY (a, b)
);

CREATE TABLE public.child (
    id integer NOT NULL,
    pa integer,
    pb integer,
    CONSTRAINT child_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.child
    ADD CONSTRAINT child_fk FOREIGN KEY (pa, pb) REFERENCES public.parent(a, b);
`
    const out = sqlToDbml(sql)
    expect(out).toContain('Ref: child.(pa, pb) > parent.(a, b)')
  })
})
