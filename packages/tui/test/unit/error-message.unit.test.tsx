import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import {
    ErrorMessage,
    parseTuiError,
    FormattedErrorText,
} from '../../src/components/messages/error-message'

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
            'Rate limit or quota exhausted from LLM provider. Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://app.trydecember.com/settings/billing\n429 Too Many Requests: RESOURCE_EXHAUSTED'
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

    it('renders error messages and hints with URLs highlighted in brand blue color', () => {
        const { lastFrame } = render(
            <ErrorMessage
                message="Insufficient credits in your Arcee AI account."
                hint="Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys"
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Insufficient credits in your Arcee AI account.')
        expect(frame).toContain('https://platform.arcee.ai/api/api-keys')
    })

    it('renders FormattedErrorText highlighting URL parts with brand blue color', () => {
        const { lastFrame } = render(
            <FormattedErrorText
                text="Please visit https://platform.arcee.ai/api/api-keys for billing."
                defaultColor="white"
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('https://platform.arcee.ai/api/api-keys')
        expect(frame).toContain('Please visit')
        expect(frame).toContain('for billing.')
    })

    it('parses multi-line Sarvam AI error strings via parseTuiError and renders structured layout', () => {
        const multiLine =
            'Insufficient credits in your Sarvam AI account. Please add credits or top up your balance at https://indus.sarvam.ai/\n402 Payment Required'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Insufficient credits in your Sarvam AI account.')
        expect(parsed.cause).toBe('402 Payment Required')
        expect(parsed.hint).toBe(
            'Please add credits or top up your balance at https://indus.sarvam.ai/'
        )

        const { lastFrame } = render(<ErrorMessage message={multiLine} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Insufficient credits in your Sarvam AI account.')
        expect(frame).toContain('https://indus.sarvam.ai/')
    })

    it('parses single-line December Wallet error strings via parseTuiError and renders structured layout', () => {
        const singleLine =
            'Insufficient credits in December Wallet. Please add credits at https://app.trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.'
        const parsed = parseTuiError(singleLine)

        expect(parsed.message).toBe('Insufficient credits in December Wallet.')
        expect(parsed.hint).toBe(
            'Please add credits at https://app.trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.'
        )

        const { lastFrame } = render(<ErrorMessage message={singleLine} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Insufficient credits in December Wallet.')
        expect(frame).toContain('https://app.trydecember.com/settings/billing')
        expect(frame).toContain('/login')
        expect(frame).not.toContain('Error:')
    })

    it('parses multi-line December Wallet 402 error strings via parseTuiError', () => {
        const multiLine =
            '402 Insufficient credits in December Wallet. Please add credits at https://app.trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.\n402 status code (no body)'
        const parsed = parseTuiError(multiLine)

        expect(parsed.message).toBe('Insufficient credits in December Wallet.')
        expect(parsed.cause).toBe('402 status code (no body)')
        expect(parsed.hint).toContain('https://app.trydecember.com/settings/billing')
    })

    it('parses bare Connection error string into informative message without hint', () => {
        const parsed = parseTuiError('Connection error.')

        expect(parsed.message).toBe('Unable to connect to LLM provider (Connection error).')
        expect(parsed.hint).toBeUndefined()

        const { lastFrame } = render(<ErrorMessage message="Connection error." />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Unable to connect to LLM provider (Connection error).')
        expect(frame).not.toContain('Error:')
    })

    it('renders multi-line connection error preserving endpoint and root cause without hint', () => {
        const errorText =
            'Unable to connect to December Cloud (Humans R1).\nEndpoint: https://api.trydecember.com/api/v1/cli (fetch failed: ENOTFOUND api.trydecember.com)'
        const parsed = parseTuiError(errorText)

        expect(parsed.message).toContain('Unable to connect to December Cloud (Humans R1).')
        expect(parsed.message).toContain('Endpoint: https://api.trydecember.com/api/v1/cli')
        expect(parsed.hint).toBeUndefined()

        const { lastFrame } = render(<ErrorMessage message={errorText} />)
        const frame = lastFrame() || ''

        expect(frame).toContain('Unable to connect to December Cloud (Humans R1).')
        expect(frame).toContain('https://api.trydecember.com/api/v1/cli')
    })
})
