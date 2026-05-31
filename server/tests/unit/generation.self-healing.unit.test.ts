import { describe, expect, test } from 'bun:test'
import {
    autoHealPlanAgentResponse,
    autoHealChangePlanResponse,
} from '../../src/modules/generation/generation.self-healing'
import {
    planAgentResponseSchema,
    projectChangePlanResponseSchema,
} from '../../src/modules/generation/generation.schema'

describe('generation self-healing layers', () => {
    test('heals missing required files and invalid file generators', () => {
        const rawResponse = {
            thinking: 'The change is local\nLet us start.',
            summary: 'Build simple page.',
            intent: {
                prompt: 'Landing page',
                summary: 'Design studio',
                projectName: 'Studio',
                appType: 'custom app-type', // Invalid, will heal
                audience: 'clients',
                primaryGoal: 'show work',
                visualDirection: 'minimal',
                keyScreens: ['Home'],
                keyCapabilities: ['Portfolio'],
                canvasSignals: [],
            },
            plan: {
                success: true,
                message: 'Plan generated',
                data: {
                    projectName: 'Studio',
                    goal: 'show work',
                    routes: [{ name: 'Home', path: '/' }],
                    architecture: {
                        appShape: 'React App',
                        routing: 'None',
                        state: 'Local',
                        styling: 'Tailwind',
                    },
                    dependencies: ['react', 'react-dom'], // Missing required tailwind etc.
                    devDependencies: ['@types/react'], // Missing @types/bun etc.
                    files: [
                        {
                            path: 'src/App.tsx',
                            purpose: 'Main app',
                            generate: true,
                            generator: 'css', // Invalid enum, will heal to static
                        },
                        {
                            path: 'src/components/Button.tsx',
                            purpose: 'Shared button',
                            generate: true,
                            generator: 'tsx', // Invalid enum, will heal to component
                        },
                    ],
                    buildOrder: ['src/App.tsx', 'src/components/Button.tsx'], // Missing required files in order
                    builderNotes: ['Simple.'],
                },
                errors: [],
            },
        }

        const healed = autoHealPlanAgentResponse(rawResponse)
        const parsed = planAgentResponseSchema.safeParse(healed)

        expect(parsed.success).toBe(true)

        if (parsed.success) {
            const data = parsed.data.plan.data!

            // Check healed appType
            expect(parsed.data.intent.appType).toBe('landing-page')

            // Check injected dependencies
            expect(data.dependencies).toContain('bun-plugin-tailwind')
            expect(data.dependencies).toContain('tailwindcss')
            expect(data.devDependencies).toContain('@types/react-dom')
            expect(data.devDependencies).toContain('@types/bun')

            // Check normalized generators
            const appFile = data.files.find((f) => f.path === 'src/App.tsx')!
            expect(appFile.generator).toBe('static')
            const btnFile = data.files.find((f) => f.path === 'src/components/Button.tsx')!
            expect(btnFile.generator).toBe('component')

            // Check required skeleton files are present and marked to generate
            const filePaths = data.files.map((f) => f.path)
            expect(filePaths).toContain('package.json')
            expect(filePaths).toContain('index.html')
            expect(filePaths).toContain('src/frontend.tsx')
            expect(filePaths).toContain('src/index.css')

            // Check buildOrder includes all generated files exactly once
            const generatedPaths = data.files.filter((f) => f.generate).map((f) => f.path)
            expect(data.buildOrder.length).toBe(generatedPaths.length)
            for (const path of generatedPaths) {
                expect(data.buildOrder).toContain(path)
            }
        }
    })

    test('heals follow-up patch plans by deduplicating operations and securing paths', () => {
        const rawResponse = {
            thinking: 'Fix the UI',
            summary: ['Apply targeted fix'],
            plan: {
                success: true,
                message: 'Patch plan generated',
                data: {
                    summary: 'Modify main app',
                    operations: [
                        {
                            path: 'src/App.tsx',
                            action: 'update',
                            purpose: 'Fix padding',
                            instructions: 'Tighten spacing',
                        },
                        {
                            path: 'src/App.tsx', // Duplicate path, will heal
                            action: 'update',
                            purpose: 'Add a banner',
                            instructions: 'Render banner at top',
                        },
                        {
                            path: 'server/src/api.ts', // Disallowed path, will heal (pruned)
                            action: 'update',
                            purpose: 'Add server log',
                            instructions: 'Log request',
                        },
                    ],
                },
                errors: [],
            },
        }

        const healed = autoHealChangePlanResponse(rawResponse)
        const parsed = projectChangePlanResponseSchema.safeParse(healed)

        expect(parsed.success).toBe(true)

        if (parsed.success) {
            const data = parsed.data.plan.data!

            // Check that operations list has been deduplicated and secured
            expect(data.operations.length).toBe(1)
            expect(data.operations[0].path).toBe('src/App.tsx')
        }
    })
})
