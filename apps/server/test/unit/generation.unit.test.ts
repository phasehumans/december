import { describe, expect, test } from 'bun:test'

import { parseModelJson } from '../../src/modules/agent/agents.utils'
import { isFrontendWorkspacePath } from '../../src/modules/generation/generation.utils'

describe('generation utility functions', () => {
    test('repairs raw line breaks inside model JSON strings', () => {
        const parsed = parseModelJson<{ thinking: string }>(
            '{"thinking":"First line\\nSecond line"}',
            'plan agent'
        )

        expect(parsed.thinking).toBe('First line\nSecond line')
    })
})

describe('generation workspace paths', () => {
    test('allows root index.html for runnable preview manifests', () => {
        expect(isFrontendWorkspacePath('index.html')).toBe(true)
    })

    test('allows configuration files at root', () => {
        expect(isFrontendWorkspacePath('vite.config.ts')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.mjs')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.cjs')).toBe(true)
        expect(isFrontendWorkspacePath('tailwind.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('tailwind.config.ts')).toBe(true)
        expect(isFrontendWorkspacePath('postcss.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('tsconfig.node.json')).toBe(true)
        expect(isFrontendWorkspacePath('components.json')).toBe(true)
        expect(isFrontendWorkspacePath('vite-env.d.ts')).toBe(true)
    })

    test('keeps backend files out of patch plans', () => {
        expect(isFrontendWorkspacePath('server/src/api.ts')).toBe(false)
    })
})

import {
    generateWebsiteSchema,
    projectPlanDataSchema,
} from '../../src/modules/generation/generation.schema'

describe('generation schemas', () => {
    describe('generateWebsiteSchema', () => {
        test('validates correct website request', () => {
            const valid = generateWebsiteSchema.safeParse({
                prompt: 'build a cool todo app',
                projectId: '33333333-4444-4333-8444-555555555555',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if prompt is too short', () => {
            const invalid = generateWebsiteSchema.safeParse({
                prompt: 'hi',
            })
            expect(invalid.success).toBe(false)
        })
    })

    describe('projectPlanDataSchema', () => {
        const getValidPlanData = () => ({
            projectName: 'my-app',
            goal: 'build an app',
            routes: [{ name: 'home', path: '/', purpose: 'home screen' }],
            architecture: {
                appShape: 'spa',
                routing: 'react-router',
                state: 'useState',
                styling: 'tailwind',
            },
            dependencies: ['react', 'react-dom', 'bun-plugin-tailwind', 'tailwindcss'],
            devDependencies: ['@types/react', '@types/react-dom', '@types/bun'],
            files: [
                {
                    path: 'package.json',
                    purpose: 'deps',
                    generate: true,
                    generator: 'config' as const,
                },
                {
                    path: 'index.html',
                    purpose: 'html entry',
                    generate: true,
                    generator: 'static' as const,
                },
                {
                    path: 'src/frontend.tsx',
                    purpose: 'mount',
                    generate: true,
                    generator: 'app-shell' as const,
                },
                {
                    path: 'src/index.css',
                    purpose: 'styles',
                    generate: true,
                    generator: 'config' as const,
                },
                {
                    path: 'src/App.tsx',
                    purpose: 'app root',
                    generate: true,
                    generator: 'app-shell' as const,
                },
            ],
            buildOrder: [
                'package.json',
                'index.html',
                'src/frontend.tsx',
                'src/index.css',
                'src/App.tsx',
            ],
            builderNotes: [],
        })

        test('validates a correct project plan payload', () => {
            const valid = projectPlanDataSchema.safeParse(getValidPlanData())
            expect(valid.success).toBe(true)
        })

        test('fails if missing a required file path', () => {
            const data = getValidPlanData()
            // Remove 'package.json' from files and buildOrder
            data.files = data.files.filter((f) => f.path !== 'package.json')
            data.buildOrder = data.buildOrder.filter((p) => p !== 'package.json')

            const res = projectPlanDataSchema.safeParse(data)
            expect(res.success).toBe(false)
        })

        test('fails if duplicate file paths exist', () => {
            const data = getValidPlanData()
            data.files.push({
                path: 'index.html',
                purpose: 'duplicate html',
                generate: true,
                generator: 'static' as const,
            })
            data.buildOrder.push('index.html')

            const res = projectPlanDataSchema.safeParse(data)
            expect(res.success).toBe(false)
        })

        test('fails if buildOrder is missing a generated file path', () => {
            const data = getValidPlanData()
            data.buildOrder = data.buildOrder.filter((p) => p !== 'src/App.tsx')

            const res = projectPlanDataSchema.safeParse(data)
            expect(res.success).toBe(false)
        })

        test('fails if required runtime dependencies are missing', () => {
            const data = getValidPlanData()
            data.dependencies = data.dependencies.filter((d) => d !== 'react')

            const res = projectPlanDataSchema.safeParse(data)
            expect(res.success).toBe(false)
        })
    })
})
