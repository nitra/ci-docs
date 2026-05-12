import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cli, main } from '../../src/commit-push/main.mjs'

const AUTHOR = { authorName: 'sync-bot[bot]', authorEmail: 'sync-bot[bot]@users.noreply.github.com' }

/**
 * @param {string} cwd working directory
 * @param {string[]} args git args
 * @returns {string} stdout
 */
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd()
}

describe('commit-push main()', () => {
  let tmp
  /** @type {string} */
  let remoteRepo
  /** @type {string} */
  let workRepo

  /**
   * Готує локальний bare-remote + work-репо, що пушить туди.
   * @returns {{remoteRepo: string, workRepo: string}} шляхи
   */
  function setup() {
    tmp = mkdtempSync(join(tmpdir(), 'commit-push-'))
    remoteRepo = join(tmp, 'remote.git')
    workRepo = join(tmp, 'work')

    execFileSync('git', ['init', '--bare', '--initial-branch=main', remoteRepo])
    execFileSync('git', ['init', '--initial-branch=main', workRepo])

    git(workRepo, ['config', 'user.name', 'init-bot'])
    git(workRepo, ['config', 'user.email', 'init@bot'])
    writeFileSync(join(workRepo, 'README.md'), '# initial\n')
    git(workRepo, ['add', 'README.md'])
    git(workRepo, ['commit', '-m', 'initial'])
    git(workRepo, ['remote', 'add', 'origin', remoteRepo])
    git(workRepo, ['push', 'origin', 'main'])

    return { remoteRepo, workRepo }
  }

  afterEach(() => {
    if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
  })

  it('комітить нові файли, пушить у remote, повертає sha', () => {
    const { remoteRepo, workRepo } = setup()
    mkdirSync(join(workRepo, 'npm'), { recursive: true })
    writeFileSync(join(workRepo, 'npm/file-a.txt'), 'A\n')
    writeFileSync(join(workRepo, 'npm/file-b.txt'), 'B\n')

    const result = main({
      repo: workRepo,
      files: ['npm/file-a.txt', 'npm/file-b.txt'],
      message: 'chore: add files',
      ...AUTHOR
    })

    expect(result.committed).toBe(true)
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/)

    expect(git(remoteRepo, ['log', '-1', '--pretty=%s', 'main'])).toBe('chore: add files')
    expect(git(remoteRepo, ['log', '-1', '--pretty=%an', 'main'])).toBe('sync-bot[bot]')
    expect(git(remoteRepo, ['log', '-1', '--pretty=%ae', 'main'])).toBe('sync-bot[bot]@users.noreply.github.com')
  })

  it('коли файли без змін → committed=false, нічого не пушить', () => {
    const { remoteRepo, workRepo } = setup()
    const remoteShaBefore = git(remoteRepo, ['rev-parse', 'main'])

    const result = main({
      repo: workRepo,
      files: ['README.md'], // unchanged from initial commit
      message: 'noop',
      ...AUTHOR
    })

    expect(result.committed).toBe(false)
    expect(result.sha).toBeNull()
    expect(git(remoteRepo, ['rev-parse', 'main'])).toBe(remoteShaBefore)
  })

  it('multiline-повідомлення зберігається у тілі коміту', () => {
    const { remoteRepo, workRepo } = setup()
    writeFileSync(join(workRepo, 'CHANGELOG.md'), 'changelog body\n')

    const message = 'chore(schema): sync from db@abc1234\n\nBump: patch\nVersion: 0.0.3'
    main({
      repo: workRepo,
      files: ['CHANGELOG.md'],
      message,
      ...AUTHOR
    })

    expect(git(remoteRepo, ['log', '-1', '--pretty=%B', 'main'])).toBe(message)
  })

  it('кастомна гілка/remote — пушить туди', () => {
    const { workRepo } = setup()
    const upstream = join(tmpdir(), `commit-push-upstream-${Date.now()}.git`)
    execFileSync('git', ['init', '--bare', '--initial-branch=develop', upstream])
    git(workRepo, ['remote', 'add', 'upstream', upstream])
    git(workRepo, ['branch', '-c', 'main', 'develop'])
    writeFileSync(join(workRepo, 'new.txt'), 'x\n')

    try {
      main({
        repo: workRepo,
        files: ['new.txt'],
        message: 'on develop',
        branch: 'develop',
        remote: 'upstream',
        ...AUTHOR
      })

      expect(git(upstream, ['log', '-1', '--pretty=%s', 'develop'])).toBe('on develop')
    } finally {
      rmSync(upstream, { recursive: true, force: true })
    }
  })
})

describe('commit-push cli()', () => {
  let tmp
  /** @type {string} */
  let remoteRepo
  /** @type {string} */
  let workRepo

  function setup() {
    tmp = mkdtempSync(join(tmpdir(), 'commit-push-cli-'))
    remoteRepo = join(tmp, 'remote.git')
    workRepo = join(tmp, 'work')

    execFileSync('git', ['init', '--bare', '--initial-branch=main', remoteRepo])
    execFileSync('git', ['init', '--initial-branch=main', workRepo])

    git(workRepo, ['config', 'user.name', 'init'])
    git(workRepo, ['config', 'user.email', 'init@x'])
    writeFileSync(join(workRepo, 'README.md'), 'init\n')
    git(workRepo, ['add', 'README.md'])
    git(workRepo, ['commit', '-m', 'init'])
    git(workRepo, ['remote', 'add', 'origin', remoteRepo])
    git(workRepo, ['push', 'origin', 'main'])
  }

  afterEach(() => {
    if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
  })

  it('запускає main із розпарсених аргументів', () => {
    setup()
    writeFileSync(join(workRepo, 'a.txt'), 'a\n')
    writeFileSync(join(workRepo, 'b.txt'), 'b\n')

    const result = cli([
      '--repo', workRepo,
      '--message', 'add a and b',
      '--file', 'a.txt',
      '--file', 'b.txt',
      '--author-name', 'bot[bot]',
      '--author-email', 'bot@x'
    ])

    expect(result.committed).toBe(true)
    expect(git(remoteRepo, ['log', '-1', '--pretty=%s', 'main'])).toBe('add a and b')
  })

  it('кидає помилку коли немає --file', () => {
    expect(() =>
      cli([
        '--repo', '/tmp/x',
        '--message', 'msg',
        '--author-name', 'a',
        '--author-email', 'b'
      ])
    ).toThrow('--file is required')
  })

  it('кидає помилку на брак --repo', () => {
    expect(() =>
      cli(['--message', 'msg', '--file', 'a', '--author-name', 'a', '--author-email', 'b'])
    ).toThrow('--repo is required')
  })
})
