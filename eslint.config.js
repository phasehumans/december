// eslint.config.js

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
    /**
     * Ignore files
     */
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/out/**',
            '**/*.min.js',
            '**/runtime/**',
        ],
    },

    /**
     * Base ESLint recommended
     */
    js.configs.recommended,

    /**
     * TypeScript recommended
     */
    ...tseslint.configs.recommended,

    /**
     * Main TS/React config
     */
    {
        files: ['**/*.{ts,tsx}'],

        languageOptions: {
            parser: tseslint.parser,

            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },

            globals: {
                ...globals.browser,
                ...globals.node,
            },
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
            /**
             * React
             */
            'react/react-in-jsx-scope': 'off',

            /**
             * React Hooks
             */
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            /**
             * Imports
             */
            'import/order': [
                'warn',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index',
                        'type',
                    ],

                    'newlines-between': 'always',

                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],

            /**
             * Unused imports
             */
            'unused-imports/no-unused-imports': 'warn',

            /**
             * TypeScript
             */
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',

            /**
             * General
             */
            'no-console': 'off',
        },
    },

    /**
     * JS files
     */
    {
        files: ['**/*.{js,mjs,cjs}'],

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },

    /**
     * Disable formatting conflicts
     */
    prettier
)
