import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-config-prettier'

export default [
    {
        ignores: [
            'node_modules',
            'dist',
            'build',
            'coverage',
            '.next',
            '.turbo',
            'bun.lockb',
            '*.config.js',
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/.turbo/**',
            '**/out/**',
            '**/*.min.js',
            '**/public/**',
        ],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.{ts,tsx,js,jsx}'],

        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },

        plugins: {
            react,
            'react-hooks': reactHooks,
            import: importPlugin,
            'unused-imports': unusedImports,
        },

        settings: {
            react: {
                version: 'detect',
            },
        },

        rules: {
            'react/react-in-jsx-scope': 'off',

            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            'import/order': [
                'warn',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    'newlines-between': 'always',
                },
            ],

            'unused-imports/no-unused-imports': 'error',

            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
        },
    },

    prettier,
]
