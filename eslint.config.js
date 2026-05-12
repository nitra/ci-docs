import { getConfig } from '@nitra/eslint-config'

export default [
  {
    ignores: ['**/auto-imports.d.ts']
  },
  {
    languageOptions: {
      globals: {
        __GITHUB_SHA__: 'readonly',
        __BRANCH__: 'readonly'
      }
    }
  },
  ...getConfig({ node: ['npm'] })
]
