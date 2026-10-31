import { describe, test, expect } from 'bun:test'

import {
    assembleSystemPrompt,
    getModelFamily,
    getModelFamilyPrompt,
    getModelTier,
    isCompactModel,
    isReasoningModel,
} from '../../src/prompts'

describe('Prompts & Model Specialization (Unit)', () => {
    describe('Model Classification', () => {
        test('identifies modern reasoning models across major providers', () => {
            const reasoningModels = [
                'o3-pro',
                'o3-mini',
                'o4-mini',
                'o1',
                'claude-opus-5',
                'claude-sonnet-5',
                'claude-fable-5-1',
                'claude-sonnet-4-6',
                'gemini-3.8-flash',
                'gemini-3.7-flash',
                'gemini-2.5-pro',
                'deepseek-v4-pro',
                'deepseek-r1',
                'glm-5.3',
            ]

            for (const model of reasoningModels) {
                expect(isReasoningModel(model)).toBe(true)
                expect(getModelTier(model)).toBe('reasoning')
            }
        })

        test('identifies compact and smaller models', () => {
            const compactModels = [
                'gemini-3.5-flash-lite',
                'gemini-2.5-flash-lite',
                'gpt-4o-mini',
                'gpt-5.4-mini',
                'gpt-5.4-nano',
                'qwen-2.5-coder-7b',
                'llama-3.1-8b',
                'ministral-3-14b',
            ]

            for (const model of compactModels) {
                expect(isCompactModel(model)).toBe(true)
            }
        })

        test('identifies model families correctly', () => {
            expect(getModelFamily('claude-sonnet-5')).toBe('anthropic')
            expect(getModelFamily('claude-opus-4-7')).toBe('anthropic')
            expect(getModelFamily('gemini-3.8-flash')).toBe('google')
            expect(getModelFamily('gemini-2.5-pro')).toBe('google')
            expect(getModelFamily('gpt-5.6-sol')).toBe('openai')
            expect(getModelFamily('o3-mini')).toBe('openai')
            expect(getModelFamily('deepseek-v4-pro')).toBe('deepseek')
            expect(getModelFamily('mistral-large')).toBe('generic')
        })
    })

    describe('Model Specialization Prompts', () => {
        test('provides diff-first protocol and concise chat output for reasoning models', () => {
            const result = getModelFamilyPrompt({ model: 'o3-pro' })
            expect(result.roleGuidelines).toContain('Autonomous Reasoning & Verification')
            expect(result.roleGuidelines).toContain('Diff-First Protocol ("Diff Model")')
            expect(result.roleGuidelines).toContain('plan surgical patches in your thinking trace')
            expect(result.roleGuidelines).toContain("exclusively via 'edit_file'")
            expect(result.roleGuidelines).toContain('Concise Chat Output')
            expect(result.suppressThoughtTags).toBe(true)
        })

        test('provides step-by-step cadence and strict schema adherence for compact models', () => {
            const result = getModelFamilyPrompt({ model: 'gpt-4o-mini' })
            expect(result.roleGuidelines).toContain('Compact Model Execution & Grounding')
            expect(result.roleGuidelines).toContain('Step-by-Step Cadence')
            expect(result.roleGuidelines).toContain('1) Locate: verify file path')
            expect(result.roleGuidelines).toContain('2) Read: inspect exact lines')
            expect(result.roleGuidelines).toContain('3) Edit: apply targeted edits')
            expect(result.roleGuidelines).toContain('4) Verify: run tests')
            expect(result.roleGuidelines).toContain('Strict Schema Adherence')
            expect(result.roleGuidelines).toContain('Direct Grounding')
        })

        test('combines family guidelines and tier guidelines for Claude reasoning models', () => {
            const result = getModelFamilyPrompt({ model: 'claude-sonnet-5' })
            // Anthropic family
            expect(result.roleGuidelines).toContain('Anthropic / Claude')
            expect(result.roleGuidelines).toContain('Objectivity & Discipline')
            expect(result.roleGuidelines).toContain('Proactive Task Breakdown')
            // Reasoning tier
            expect(result.roleGuidelines).toContain('Autonomous Reasoning & Verification')
            expect(result.roleGuidelines).toContain('Diff-First Protocol ("Diff Model")')
        })

        test('combines family guidelines and tier guidelines for Gemini reasoning models', () => {
            const result = getModelFamilyPrompt({ model: 'gemini-3.8-flash' })
            // Gemini family
            expect(result.roleGuidelines).toContain('Model Specialization (Gemini)')
            expect(result.roleGuidelines).toContain('STRICTLY specify absolute file paths')
            expect(result.roleGuidelines).toContain('Structured Execution')
            // Reasoning tier
            expect(result.roleGuidelines).toContain('Autonomous Reasoning & Verification')
            expect(result.roleGuidelines).toContain('Diff-First Protocol ("Diff Model")')
        })
    })

    describe('System Prompt Assembly & Caching Order', () => {
        test('assembles system prompt with static-first ordering for prompt caching', () => {
            const prompt = assembleSystemPrompt({
                workspaceDir: '/test/workspace',
                modelOptions: { model: 'claude-sonnet-5' },
                tools: [
                    { name: 'read_file', description: 'Read a file', inputSchema: {} } as any,
                    { name: 'edit_file', description: 'Edit a file', inputSchema: {} } as any,
                ],
                rules: [{ path: '/test/workspace/AGENTS.md', content: 'Project rule text' }],
            })

            // 1. Static Identity & Rules come first
            const personaIdx = prompt.indexOf('You are an expert coding assistant')
            const rulesIdx = prompt.indexOf('<rules>')
            const projectContextIdx = prompt.indexOf('<project_context>')
            const cwdIdx = prompt.indexOf('<cwd>')
            const envIdx = prompt.indexOf('Current date:')

            expect(personaIdx).toBe(0)
            expect(rulesIdx).toBeGreaterThan(personaIdx)
            expect(projectContextIdx).toBeGreaterThan(rulesIdx)
            expect(cwdIdx).toBeGreaterThan(projectContextIdx)
            expect(envIdx).toBeGreaterThan(cwdIdx)
        })

        test('assembles lean Pi-style system prompt (~150 words) without redundant tool manuals or negative constraints', () => {
            const prompt = assembleSystemPrompt({
                workspaceDir: '/workspace/my-app',
                userRules: 'Follow repository conventions',
            })
            expect(prompt).toContain('You are an expert coding assistant')
            expect(prompt).toContain('<cwd>\n/workspace/my-app\n</cwd>')
            expect(prompt).toContain('Follow repository conventions')
            expect(prompt).not.toContain('Inspect Logs & Stack Traces First')
            expect(prompt).not.toContain('buildDynamicToolGuidelines')
            expect(prompt).not.toContain('Reasoning Protocol')
            const wordCount = prompt.trim().split(/\s+/).length
            expect(wordCount).toBeLessThan(150)
        })
    })
})
