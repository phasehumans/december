import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { ErrorMessage, parseTuiError } from '../../src/components/messages/error-message'

describe('ErrorMessage Component (Unit)', () => {
    it('renders plain error message with Error: prefix in error color', () => {
        const { lastFrame } = render(<ErrorMessage message="Something went wrong" />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Error: Something went wrong')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('renders custom error with indented cause and no symbols', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Failed to connect to Claude Subscription"
                cause="listen EADDRINUSE: address already in use :::53692"
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Error: Failed to connect to Claude Subscription')
        expect(frame).toContain('Cause: listen EADDRINUSE: address already in use :::53692')
        expect(frame).not.toContain('Hint:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('renders custom error with cause and actionable hint', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Model provider rejected request"
                cause='OpenRouter 402 Payment Required: {"error": {"message": "Insufficient credits"}}'
                hint="Add credits at https://openrouter.ai/settings/credits or run /login"
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Error: Model provider rejected request')
        expect(frame).toContain('Cause: OpenRouter 402 Payment Required')
        expect(frame).toContain('Hint:  Add credits at https://openrouter.ai/settings/credits')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('strips redundant leading Error: prefix from message', () => {
        const { lastFrame } = render(
            <ErrorMessage message="Error: Command failed with exit code 1" />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Error: Command failed with exit code 1')
        expect(frame).not.toContain('Error: Error:')
    })

    it('parses multi-line error strings automatically via parseTuiError', () => {
        const multiLine =
            'Rate limit or quota exhausted from LLM provider. Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://trydecember.com/pricing\n429 Too Many Requests: RESOURCE_EXHAUSTED'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Rate limit or quota exhausted from LLM provider.')
        expect(parsed.cause).toBe('429 Too Many Requests: RESOURCE_EXHAUSTED')
        expect(parsed.hint).toContain('Please upgrade your API key tier')

        const { lastFrame } = render(<ErrorMessage message={multiLine} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Error: Rate limit or quota exhausted from LLM provider.')
        expect(frame).toContain('Cause: 429 Too Many Requests: RESOURCE_EXHAUSTED')
        expect(frame).toContain('Hint:  Please upgrade your API key tier')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })
})
