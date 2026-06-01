/**
 * Стейджить файли/директорії, робить commit + push. Якщо нічого не змінилось — ні коміту, ні push.
 * `files` і `dirs` — однаково передаються у `git add` (git сам рекурсивно стейджить директорії).
 * @param {{repo: string, files?: string[], dirs?: string[], message: string, authorName: string, authorEmail: string, branch?: string, remote?: string}} params параметри
 * @returns {{committed: boolean, sha: string|null}} результат: чи був коміт і його SHA
 */
export function main({
  repo,
  files,
  dirs,
  message,
  authorName,
  authorEmail,
  branch,
  remote
}: {
  repo: string
  files?: string[]
  dirs?: string[]
  message: string
  authorName: string
  authorEmail: string
  branch?: string
  remote?: string
}): {
  committed: boolean
  sha: string | null
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
export function cli(argv?: string[]): {
  committed: boolean
  sha: string | null
}
