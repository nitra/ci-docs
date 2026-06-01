import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

/**
 * Викликає `git` як зовнішній процес з фіксованим CWD.
 * @param {string} cwd робоча директорія
 * @param {string[]} args аргументи `git`
 * @returns {string} stdout (UTF-8, без trailing newline)
 */
function git(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trimEnd()
}

/**
 * Перевіряє чи є хоч якісь стейджовані зміни.
 * @param {string} repo шлях до робочого дерева git-репо
 * @returns {boolean} true якщо є staged-зміни (diff --cached не порожній)
 */
function hasStagedChanges(repo) {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: repo, stdio: 'ignore' })
    return false
  } catch {
    return true
  }
}

/**
 * Стейджить файли/директорії, робить commit + push. Якщо нічого не змінилось — ні коміту, ні push.
 * `files` і `dirs` — однаково передаються у `git add` (git сам рекурсивно стейджить директорії).
 * @param {{repo: string, files?: string[], dirs?: string[], message: string, authorName: string, authorEmail: string, branch?: string, remote?: string}} params параметри
 * @returns {{committed: boolean, sha: string|null}} результат: чи був коміт і його SHA
 */
export function main({
  repo,
  files = [],
  dirs = [],
  message,
  authorName,
  authorEmail,
  branch = 'main',
  remote = 'origin'
}) {
  const pathspecs = [...files, ...dirs]
  if (!pathspecs.length) throw new Error('At least one --file or --dir is required')

  git(repo, ['config', 'user.name', authorName])
  git(repo, ['config', 'user.email', authorEmail])

  git(repo, ['add', '--', ...pathspecs])

  if (!hasStagedChanges(repo)) {
    return { committed: false, sha: null }
  }

  git(repo, ['commit', '-m', message])
  const sha = git(repo, ['rev-parse', 'HEAD'])
  git(repo, ['push', remote, `HEAD:${branch}`])

  return { committed: true, sha }
}

/**
 * CLI-обгортка для commit-push. Параметри як `--key value`.
 *
 * Обовʼязкові:
 *   --repo <path>           шлях до git-репо
 *   --message <msg>         повідомлення коміту
 *   --file <path>           повторюваний; шлях файлу від кореня репо
 *   --author-name <name>    Git user.name
 *   --author-email <email>  Git user.email
 *
 * Потрібен щонайменше один `--file` АБО `--dir`.
 *
 * Необовʼязкові:
 *   --dir <path>            повторюваний; директорія від кореня репо (git стейджить рекурсивно, напр. `npm/er`)
 *   --branch <name>         цільова гілка (default 'main')
 *   --remote <name>         remote (default 'origin')
 * @param {string[]} [argv] аргументи. Default — process.argv.slice(2).
 * @returns {{committed: boolean, sha: string|null}} результат main()
 */
export function cli(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      repo: { type: 'string' },
      message: { type: 'string' },
      file: { type: 'string', multiple: true, default: [] },
      dir: { type: 'string', multiple: true, default: [] },
      'author-name': { type: 'string' },
      'author-email': { type: 'string' },
      branch: { type: 'string', default: 'main' },
      remote: { type: 'string', default: 'origin' }
    },
    allowPositionals: false,
    strict: true
  })

  for (const key of ['repo', 'message', 'author-name', 'author-email']) {
    if (!values[key]) throw new Error(`--${key} is required`)
  }
  if (values.file.length === 0 && values.dir.length === 0) {
    throw new Error('At least one --file or --dir is required')
  }

  const result = main({
    repo: values.repo,
    files: values.file,
    dirs: values.dir,
    message: values.message,
    authorName: values['author-name'],
    authorEmail: values['author-email'],
    branch: values.branch,
    remote: values.remote
  })
  console.log(JSON.stringify(result, null, 2))
  return result
}
