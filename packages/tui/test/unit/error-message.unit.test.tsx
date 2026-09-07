import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { ErrorMessage, parseTuiError } from '../../src/components/messages/error-message'

describe('ErrorMessage Component (Unit)', () => {
    it('renders plain error message without Error: prefix in error color', () => {
        const { lastFrame } = render(<ErrorMessage message="Something went wrong" />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Something went wrong')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('renders custom error without rendering cause and no symbols', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Failed to connect to Claude Subscription"
                cause="listen EADDRINUSE: address already in use :::53692"
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Failed to connect to Claude Subscription')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('listen EADDRINUSE')
        expect(frame).not.toContain('Cause:')
        expect(frame).not.toContain('Hint:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('renders custom error with actionable hint without Error:, Cause:, or Hint: labels', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Model provider rejected request"
                cause='OpenRouter 402 Payment Required: {"error": {"message": "Insufficient credits"}}'
                hint="Add credits at https://openrouter.ai/settings/credits or run /login"
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Model provider rejected request')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('OpenRouter 402 Payment Required')
        expect(frame).not.toContain('Cause:')
        expect(frame).toContain(
            'Add credits at https://openrouter.ai/settings/credits or run /login'
        )
        expect(frame).not.toContain('Hint:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('strips redundant leading Error: and Cause: prefixes', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Error: Command failed with exit code 1"
                cause="Cause: process exited with code 1"
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('Command failed with exit code 1')
        expect(frame).not.toContain('process exited with code 1')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('Cause:')
    })

    it('parses multi-line error strings automatically via parseTuiError and renders without Error: or Cause:', () => {
        const multiLine =
            'Rate limit or quota exhausted from LLM provider. Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://trydecember.com/pricing\n429 Too Many Requests: RESOURCE_EXHAUSTED'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Rate limit or quota exhausted from LLM provider.')
        expect(parsed.cause).toBe('429 Too Many Requests: RESOURCE_EXHAUSTED')
        expect(parsed.hint).toContain('Please upgrade your API key tier')

        const { lastFrame } = render(<ErrorMessage message={multiLine} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Rate limit or quota exhausted from LLM provider.')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('429 Too Many Requests: RESOURCE_EXHAUSTED')
        expect(frame).not.toContain('Cause:')
        expect(frame).toContain('Please upgrade your API key tier')
        expect(frame).not.toContain('Hint:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('parses multi-line MiniMax error strings via parseTuiError and renders structured layout', () => {
        const multiLine =
            'Insufficient balance in your MiniMax account. Please top up your balance at https://platform.minimax.io/\ninsufficient balance (1008)'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Insufficient balance in your MiniMax account.')
        expect(parsed.cause).toBe('insufficient balance (1008)')
        expect(parsed.hint).toBe('Please top up your balance at https://platform.minimax.io/')

        const { lastFrame } = render(<ErrorMessage message={multiLine} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Insufficient balance in your MiniMax account.')
        expect(frame).not.toContain('insufficient balance (1008)')
        expect(frame).toContain('Please top up your balance at https://platform.minimax.io/')
        expect(frame).not.toContain('Hint:')
    })

    it('parses multi-line universal fallback error strings via parseTuiError', () => {
        const multiLine =
            'Insufficient balance or credits with your LLM provider. Please check your account balance and top up credits with your provider, or switch models using /model\n402 Payment Required'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Insufficient balance or credits with your LLM provider.')
        expect(parsed.cause).toBe('402 Payment Required')
        expect(parsed.hint).toBe(
            'Please check your account balance and top up credits with your provider, or switch models using /model'
        )
    })
})
