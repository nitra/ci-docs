#!/usr/bin/env node
/**
 * `@nitra/ci-docs` — CLI-диспатчер.
 *
 * Запуск: `npx -y \@nitra/ci-docs <subcommand> [args...]`
 *
 * Доступні subcommands:
 *   sync-schema  — інтроспект GraphQL-ендпоінта → bump → CHANGELOG → запис SDL
 *   commit-push  — git add/commit/push для оновлених файлів
 */

const SUBCOMMANDS = {
  'sync-schema': () => import('./sync-schema/main.mjs').then(m => m.cli),
  'commit-push': () => import('./commit-push/main.mjs').then(m => m.cli)
}

const [subcommand, ...rest] = process.argv.slice(2)

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  console.log(`Usage: ci-docs <subcommand> [args...]

Subcommands:
  ${Object.keys(SUBCOMMANDS).join('\n  ')}

Run \`ci-docs <subcommand> --help\` for subcommand-specific options.`)
  process.exitCode = subcommand ? 0 : 2
} else {
  const loader = SUBCOMMANDS[subcommand]
  if (loader) {
    const run = await loader()
    await run(rest)
  } else {
    console.error(`Unknown subcommand: ${subcommand}`)
    console.error(`Available: ${Object.keys(SUBCOMMANDS).join(', ')}`)
    process.exitCode = 2
  }
}
