/**
 * Стейджить файли, робить commit + push. Якщо файли не несуть змін — нічого не комітить і не пушить.
 * @param {{repo: string, files: string[], message: string, authorName: string, authorEmail: string, branch?: string, remote?: string}} params параметри
 * @returns {{committed: boolean, sha: string|null}} результат: чи був коміт і його SHA
 */
export function main({
  repo,
  files,
  message,
  authorName,
  authorEmail,
  branch,
  remote
}: {
  repo: string
  files: string[]
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
 *   --file <path>           повторюваний; шлях файлу від кореня репо (мінімум один)
 *   --author-name <name>    Git user.name
 *   --author-email <email>  Git user.email
 *
 * Необовʼязкові:
 *   --branch <name>         цільова гілка (default 'main')
 *   --remote <name>         remote (default 'origin')
 * @param {string[]} [argv] аргументи. Default — process.argv.slice(2).
 * @returns {{committed: boolean, sha: string|null}} результат main()
 */
export function cli(argv?: string[]): {
  committed: boolean
  sha: string | null
}
