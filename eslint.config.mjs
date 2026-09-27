import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    '.generated/**',
    '.vinext/**',
    '.wrangler/**',
    '.sites-runtime/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
  {
    files: ['tests/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@next/next/no-assign-module-variable': 'off',
    },
  },
  // Existing app findings stay visible until their underlying code is cleaned up.
  {
    files: ['app/page.tsx', 'app/api/league/route.ts', 'components/tennis/backup-panel.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: [
      'app/page.tsx',
      'components/tennis/banner-settings.tsx',
      'components/tennis/match-timing.tsx',
      'components/tennis/tv-view.tsx',
    ],
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['app/page.tsx'],
    rules: {
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  {
    files: ['components/ui/**/*.{ts,tsx}', 'hooks/use-mobile.ts'],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);

export default eslintConfig;
