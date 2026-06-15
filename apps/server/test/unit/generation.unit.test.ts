import { describe, expect, test } from 'bun:test'

import { parseModelJson } from '../../src/modules/agent/agents.utils'
import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    planAgentResponseSchema,
    projectChangePlanSchema,
    projectChangePlanResponseSchema,
} from '../../src/modules/generation/generation.schema'
import { isFrontendWorkspacePath } from '../../src/modules/generation/generation.utils'

describe('generation schemas', () => {
    test('accepts a unified plan response with thoughts, plan_of_action, intent, and build handoff', () => {
        const parsed = planAgentResponseSchema.safeParse({
            thoughts: ['This should stay compact', 'A single route is enough'],
            plan_of_action: ['Build a focused landing page first.'],
            intent: {
                prompt: 'Create a landing page for a design studio.',
                summary: 'A polished studio landing page',
                projectName: 'Design Studio',
                appType: 'landing-page',
                audience: 'prospective clients',
                primaryGoal: 'help visitors understand the studio and make contact',
                visualDirection: 'editorial, calm, image-led',
                keyScreens: ['Home'],
                keyCapabilities: ['Service Overview', 'Contact CTA'],
                canvasSignals: [],
            },
            plan: {
                success: true,
                message: 'Project plan generated successfully',
                data: {
                    projectName: 'Design Studio',
                    goal: 'Create a clear first-pass marketing site for the studio.',
                    routes: [
                        {
                            name: 'Home',
                            path: '/',
                            purpose: 'Introduce the studio and drive contact',
                        },
                    ],
                    architecture: {
                        appShape: 'Single-page marketing site',
                        routing: 'No router needed for one route',
                        state: 'Static content with lightweight local UI state only',
                        styling: 'Tailwind-driven editorial layout',
                    },
                    dependencies: ['react', 'react-dom', 'bun-plugin-tailwind', 'tailwindcss'],
                    devDependencies: ['@types/react', '@types/react-dom', '@types/bun'],
                    files: [
                        {
                            path: 'package.json',
                            purpose: 'Declare scripts and dependencies',
                            generate: true,
                            generator: 'config',
                        },
                        {
                            path: 'index.html',
                            purpose: 'Mount the React app',
                            generate: true,
                            generator: 'static',
                        },
                        {
                            path: 'src/frontend.tsx',
                            purpose: 'Mount React into the root element',
                            generate: true,
                            generator: 'app-shell',
                        },
                        {
                            path: 'src/index.css',
                            purpose: 'Provide global styles',
                            generate: true,
                            generator: 'static',
                        },
                        {
                            path: 'src/App.tsx',
                            purpose: 'Compose the landing page',
                            generate: true,
                            generator: 'app-shell',
                        },
                    ],
                    buildOrder: [
                        'package.json',
                        'index.html',
                        'src/index.css',
                        'src/frontend.tsx',
                        'src/App.tsx',
                    ],
                    builderNotes: ['Keep the first pass compact and responsive.'],
                },
                errors: [],
            },
        })

        expect(parsed.success).toBe(true)
    })

    test('rejects project plans missing the runnable app skeleton', () => {
        const parsed = planAgentResponseSchema.safeParse({
            thinking: ['Keep the first pass small.'],
            summary: ['Build the smallest useful landing page.'],
            intent: {
                prompt: 'Create a landing page for a design studio.',
                summary: 'A polished studio landing page',
                projectName: 'Design Studio',
                appType: 'landing-page',
                audience: 'prospective clients',
                primaryGoal: 'help visitors understand the studio and make contact',
                visualDirection: 'editorial, calm, image-led',
                keyScreens: ['Home'],
                keyCapabilities: ['Service Overview', 'Contact CTA'],
                canvasSignals: [],
            },
            plan: {
                success: true,
                message: 'Project plan generated successfully',
                data: {
                    projectName: 'Design Studio',
                    goal: 'Create a clear first-pass marketing site for the studio.',
                    routes: [],
                    architecture: {
                        appShape: 'Single-page marketing site',
                        routing: 'No router needed for one route',
                        state: 'Static content',
                        styling: 'Tailwind-driven editorial layout',
                    },
                    dependencies: ['react', 'react-dom', 'bun-plugin-tailwind', 'tailwindcss'],
                    devDependencies: ['@types/react', '@types/react-dom', '@types/bun'],
                    files: [
                        {
                            path: 'src/App.tsx',
                            purpose: 'Compose the landing page',
                            generate: true,
                            generator: 'app-shell',
                        },
                    ],
                    buildOrder: ['src/App.tsx'],
                    builderNotes: ['Keep the first pass compact and responsive.'],
                },
                errors: [],
            },
        })

        expect(parsed.success).toBe(false)
    })

    test('accepts streamed edit requests with prompt and project id', () => {
        const parsed = applyProjectEditSchema.safeParse({
            projectId: '11111111-1111-4111-8111-111111111111',
            prompt: 'Make the hero more compact',
        })

        expect(parsed.success).toBe(true)
    })

    test('accepts streamed fix requests with runtime error details', () => {
        const parsed = applyProjectFixSchema.safeParse({
            projectId: '11111111-1111-4111-8111-111111111111',
            errorMessage: 'Failed to resolve import ./Missing',
            stack: 'at App.tsx:4:1',
        })

        expect(parsed.success).toBe(true)
    })

    test('rejects duplicate patch operation paths', () => {
        const parsed = projectChangePlanSchema.safeParse({
            success: true,
            message: 'Patch plan generated successfully',
            data: {
                summary: 'Update hero copy',
                operations: [
                    {
                        path: 'src/App.tsx',
                        action: 'update',
                        purpose: 'Update hero copy',
                        instructions: 'Change the headline text',
                    },
                    {
                        path: 'src/App.tsx',
                        action: 'update',
                        purpose: 'Update hero layout',
                        instructions: 'Tighten spacing',
                    },
                ],
            },
            errors: [],
        })

        expect(parsed.success).toBe(false)
    })

    test('accepts follow-up planning responses with thoughts and plan_of_action', () => {
        const parsed = projectChangePlanResponseSchema.safeParse({
            thoughts: ['The change is local', 'App.tsx owns that section'],
            plan_of_action: ['Tighten the hero without reshaping the rest of the page.'],
            plan: {
                success: true,
                message: 'Patch plan generated successfully',
                data: {
                    summary: 'Tighten the hero spacing',
                    operations: [
                        {
                            path: 'src/App.tsx',
                            action: 'update',
                            purpose: 'Reduce hero spacing',
                            instructions: 'Keep the copy and layout, but tighten vertical padding.',
                        },
                    ],
                },
                errors: [],
            },
        })

        expect(parsed.success).toBe(true)
    })

    test('repairs raw line breaks inside model JSON strings', () => {
        const parsed = parseModelJson<{ thinking: string }>(
            '{"thinking":"First line\nSecond line"}',
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
