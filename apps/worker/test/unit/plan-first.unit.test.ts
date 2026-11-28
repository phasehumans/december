import { readSessionRunConfig } from '@december/shared'
import { describe, it, expect } from 'bun:test'

import { withPlanFirst } from '../../src/plan-first'

describe('plan first and the session run config (#632)', () => {
    it('keeps the prompt and asks for a plan and an approval before any change', () => {
        const prompt = withPlanFirst('add a login page')
        expect(prompt.startsWith('add a login page')).toBe(true)
        expect(prompt).toContain('ask_question')
        expect(prompt).toContain('do not create, edit or delete files')
    })

    it('reads the saved config and falls back for missing or bad fields', () => {
        // a missing or bad speed falls back to fast, the start value of a new session
        expect(readSessionRunConfig(null)).toEqual({
            planFirst: false,
            effort: 'fast',
            openPullRequest: true,
        })
        expect(
            readSessionRunConfig({ planFirst: true, effort: 'max', openPullRequest: 'no' })
        ).toEqual({ planFirst: true, effort: 'fast', openPullRequest: true })
        expect(readSessionRunConfig({ effort: 'deep', openPullRequest: false })).toEqual({
            planFirst: false,
            effort: 'deep',
            openPullRequest: false,
        })
    })
})
