#!/usr/bin/env node
/**
 * `@nitra/ci-docs` — CLI-диспатчер.
 *
 * Запуск: `npx -y @nitra/ci-docs <subcommand> [args...]`
 *
 * Доступні subcommands:
 *   sync-schema  — інтроспект Hasura → bump → CHANGELOG → копіювання SDL
 */

const SUBCOMMANDS = {
  'sync-schema': () => import('./sync-schema/main.mjs').then(m => m.cli)
}

const [subcommand, ...rest] = process.argv.slice(2)

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  console.log(`Usage: ci-docs <subcommand> [args...]

Subcommands:
  ${Object.keys(SUBCOMMANDS).join('\n  ')}

Run \`ci-docs <subcommand> --help\` for subcommand-specific options.`)
  process.exit(subcommand ? 0 : 2)
}

const loader = SUBCOMMANDS[subcommand]
if (!loader) {
  console.error(`Unknown subcommand: ${subcommand}`)
  console.error(`Available: ${Object.keys(SUBCOMMANDS).join(', ')}`)
  process.exit(2)
}

const run = await loader()
await run(rest)
