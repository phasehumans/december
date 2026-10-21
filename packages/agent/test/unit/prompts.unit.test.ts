import { describe, test, expect } from 'bun:test'

import { AgentHarness } from '../../src/harness/agent-harness'
import {
    assembleSystemPrompt,
    getModelFamily,
    getModelFamilyPrompt,
    getModelTier,
    isCompactModel,
    isReasoningModel,
} from '../../src/prompts'
import { MockLLM } from '../mock-provider'

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

            // 1. Identity & Core Principles come first
            const personaIdx = prompt.indexOf('You are December')
            const principlesIdx = prompt.indexOf('Core Operating Principles & Guardrails')
            const modelSpecIdx = prompt.indexOf('Model Specialization')
            const toolSpecIdx = prompt.indexOf('Tool Selection & Guidelines')
            const rulesIdx = prompt.indexOf('<project_context>')
            const envIdx = prompt.indexOf('Current date:')

            expect(personaIdx).toBeGreaterThanOrEqual(0)
            expect(principlesIdx).toBeGreaterThan(personaIdx)
            expect(modelSpecIdx).toBeGreaterThan(principlesIdx)
            expect(toolSpecIdx).toBeGreaterThan(modelSpecIdx)
            expect(rulesIdx).toBeGreaterThan(toolSpecIdx)
            expect(envIdx).toBeGreaterThan(rulesIdx)
        })

        test('dynamically updates system prompt on AgentHarness.updateModel without losing rules', () => {
            const harness = new AgentHarness({
                llm: new MockLLM(),
                tools: [{ name: 'read_file', description: 'Read', inputSchema: {} } as any],
                operations: {} as any,
                workspaceDir: '/tmp',
                modelOptions: { model: 'gpt-4o-mini' },
            })

            const initialPrompt = harness.getAgent().systemPrompt
            expect(initialPrompt).toContain('Compact Model Execution & Grounding')
            expect(initialPrompt).not.toContain('Diff-First Protocol ("Diff Model")')

            // Switch model to modern reasoning model (claude-sonnet-5)
            harness.updateModel('claude-sonnet-5')
            const updatedPrompt = harness.getAgent().systemPrompt
            expect(updatedPrompt).toContain('Anthropic / Claude')
            expect(updatedPrompt).toContain('Autonomous Reasoning & Verification')
            expect(updatedPrompt).toContain('Diff-First Protocol ("Diff Model")')
            expect(updatedPrompt).not.toContain('Compact Model Execution & Grounding')
        })

        test('dynamically refreshes tool guidelines when deferred tools are activated', () => {
            const harness = new AgentHarness({
                llm: new MockLLM(),
                tools: [{ name: 'read_file', description: 'Read', inputSchema: {} } as any],
                deferredTools: [
                    {
                        name: 'grep_search',
                        description: 'Grep search',
                        inputSchema: {},
                    } as any,
                ],
                operations: {} as any,
                workspaceDir: '/tmp',
            })

            expect(harness.getAgent().systemPrompt).not.toContain(
                "Use 'grep_search' for exact matching"
            )

            // Dynamically activate grep_search
            const activated = harness.getAgent().activateDeferredTool('grep_search')
            expect(activated).toBe(true)

            // System prompt should now contain grep_search guidelines
            expect(harness.getAgent().systemPrompt).toContain(
                "Use 'grep_search' for exact matching"
            )
        })
    })
})
