import { describe, test, expect } from 'bun:test'

import {
    getGrillPrompt,
    getPlanPrompt,
    getPlanExecutionPrompt,
    getPlanRefinePrompt,
} from '../src/constants/prompts'

describe('CLI Prompts (Unit)', () => {
    test('getGrillPrompt generates structured JSON instructions with dynamic question count', () => {
        const prompt = getGrillPrompt('Add Dark Mode')
        expect(prompt).toContain('The user wants to implement: "Add Dark Mode"')
        expect(prompt).toContain('between 1 and 4 targeted, high-impact multiple-choice questions')
        expect(prompt).toContain('Return the output strictly as a JSON array')
        expect(prompt).not.toContain('<project_context>')
    })

    test('getGrillPrompt includes projectContext when provided', () => {
        const context = 'AGENTS.md rules: Use TailwindCSS, React 18, and Vite'
        const prompt = getGrillPrompt('Add Dark Mode', context)
        expect(prompt).toContain('<project_context>')
        expect(prompt).toContain(context)
        expect(prompt).toContain('Leverage the provided project context')
    })

    test('getPlanPrompt formats QA pairs correctly', () => {
        const prompt = getPlanPrompt('Add Dark Mode', [
            { question: 'Which theme strategy?', answer: 'CSS Variables' },
        ])
        expect(prompt).toContain('Q: Which theme strategy?')
        expect(prompt).toContain('A: CSS Variables')
        expect(prompt).toContain('### Implementation Plan')
    })

    test('getPlanExecutionPrompt generates execution directive authorizing tools', () => {
        const prompt = getPlanExecutionPrompt(
            'Add Dark Mode',
            '### Implementation Plan\n1. Modify theme.ts',
            [{ question: 'Which theme strategy?', answer: 'CSS Variables' }]
        )
        expect(prompt).toContain(
            'The user has approved the implementation plan for: "Add Dark Mode"'
        )
        expect(prompt).toContain('Q: Which theme strategy?')
        expect(prompt).toContain('### Implementation Plan')
        expect(prompt).toContain(
            'You are now in execution mode. Proceed with implementation immediately.'
        )
        expect(prompt).toContain('using your available tools')
    })

    test('getPlanRefinePrompt incorporates previous plan and user feedback', () => {
        const prompt = getPlanRefinePrompt(
            'Add Dark Mode',
            '### Implementation Plan\n1. Modify theme.ts',
            'Use Tailwind classes instead of CSS variables'
        )
        expect(prompt).toContain('The user wants to implement: "Add Dark Mode"')
        expect(prompt).toContain('Previous Implementation Plan:')
        expect(prompt).toContain('Use Tailwind classes instead of CSS variables')
        expect(prompt).toContain('Do NOT execute any tools. Only describe the updated plan.')
    })
})
