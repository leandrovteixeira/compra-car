import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['**/.next/**', '**/.turbo/**', '**/coverage/**', '**/dist/**'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
  },
});
