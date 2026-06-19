import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'dev/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    // TypeScript already resolves identifiers, so no-undef is noise for the
    // browser/DOM globals the widget relies on.
    rules: { 'no-undef': 'off' },
  },
)
