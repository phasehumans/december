import { describe, expect, it } from 'bun:test'

import { extractThoughtTopic, formatThought } from '../../src/utils/thought'

describe('formatThought & extractThoughtTopic', () => {
    it('formats raw thought by stripping markdown scaffolding and list bullets', () => {
        const raw = `
### Goal Understanding:
* **Goal Understanding:** Analyzing the websocket gateway
* Need to review socket handlers
`
        const cleaned = formatThought(raw)
        expect(cleaned).toContain('Analyzing the websocket gateway')
        expect(cleaned).toContain('Need to review socket handlers')
        expect(cleaned).not.toContain('###')
        expect(cleaned).not.toContain('**')
    })

    it('extracts concise topic sentence and lowercases leading character', () => {
        const raw = `
Let me check the implementation of token verification.
I need to inspect the auth headers in the request.
`
        const topic = extractThoughtTopic(raw)
        expect(topic).toBe('inspect the auth headers in the request')
    })

    it('truncates very long topics exceeding max length', () => {
        const raw =
            'I need to thoroughly investigate the exact mechanism through which the credentials are refreshed across all providers'
        const topic = extractThoughtTopic(raw)
        expect(topic.length).toBeLessThanOrEqual(48)
        expect(topic.endsWith('...')).toBe(true)
    })

    it('returns empty string for empty input', () => {
        expect(extractThoughtTopic('')).toBe('')
    })
})
