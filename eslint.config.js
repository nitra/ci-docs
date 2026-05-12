import { getConfig } from '@nitra/eslint-config'

export default [
  {
    languageOptions: {
      globals: {
        __GITHUB_SHA__: 'readonly',
        __BRANCH__: 'readonly'
      }
    }
  },
  ...getConfig({ node: ['npm', 'vue', 'demo/node'] })
]
