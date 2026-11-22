import { describe, expect, it } from 'bun:test'

import { classifyProviderError } from '../../src/errors'

/** shapes copied from the openai, anthropic and google sdks and from live provider answers */
const openaiError = (status: number, code: string | null, message: string) =>
    Object.assign(new Error(`${status} ${message}`), {
        status,
        code,
        error: { message, type: 'invalid_request_error', code },
    })

const anthropicError = (status: number, type: string, message: string) =>
    Object.assign(new Error(message), {
        status,
        error: { type: 'error', error: { type, message } },
    })

const googleError = (status: number, googleStatus: string, message: string) =>
    Object.assign(
        new Error(JSON.stringify({ error: { code: status, message, status: googleStatus } })),
        { status }
    )

describe('classifyProviderError', () => {
    it('finds model not available from the status and the error code', () => {
        expect(
            classifyProviderError(
                openaiError(404, 'model_not_found', 'The model `gpt-9` does not exist'),
                'gpt-9'
            ).kind
        ).toBe('model_unavailable')
        expect(
            classifyProviderError(
                anthropicError(404, 'not_found_error', 'model: claude-9'),
                'claude-9'
            ).kind
        ).toBe('model_unavailable')
        expect(
            classifyProviderError(
                googleError(
                    404,
                    'NOT_FOUND',
                    'models/gemini-9 is not found for API version v1beta'
                ),
                'gemini-9'
            ).kind
        ).toBe('model_unavailable')
        // xai answers an unknown model with 400
        expect(
            classifyProviderError(
                openaiError(
                    400,
                    null,
                    'The model grok-9 does not exist or your team does not have access to it.'
                ),
                'grok-9'
            ).kind
        ).toBe('model_unavailable')
        // one-api style gateways
        expect(classifyProviderError(new Error('无可用渠道 for model x')).kind).toBe(
            'model_unavailable'
        )
    })

    it('does not offer a model switch for a wrong base url', () => {
        const err = Object.assign(new Error('404 page not found'), { status: 404 })
        expect(classifyProviderError(err, 'gpt-5').kind).toBe('endpoint_not_found')
    })

    it('does not offer a model switch for a bad tool schema (gemini INVALID_ARGUMENT)', () => {
        const err = googleError(
            400,
            'INVALID_ARGUMENT',
            'Invalid JSON payload received. Unknown name "additionalProperties" at \'tools[0].function_declarations[0].parameters\''
        )
        expect(classifyProviderError(err, 'gemini-3.8-flash').kind).toBe('bad_request')
    })

    it('tells bad key, forbidden, no credits and rate limit apart', () => {
        expect(
            classifyProviderError(openaiError(401, 'invalid_api_key', 'Incorrect API key')).kind
        ).toBe('bad_key')
        expect(
            classifyProviderError(
                googleError(
                    400,
                    'INVALID_ARGUMENT',
                    'API key not valid. Please pass a valid API key.'
                )
            ).kind
        ).toBe('bad_key')
        expect(
            classifyProviderError(anthropicError(403, 'permission_error', 'not allowed in region'))
                .kind
        ).toBe('forbidden')
        expect(
            classifyProviderError(openaiError(429, 'insufficient_quota', 'You exceeded your quota'))
                .kind
        ).toBe('no_credits')
        expect(
            classifyProviderError(Object.assign(new Error('Payment Required'), { status: 402 }))
                .kind
        ).toBe('no_credits')
        expect(
            classifyProviderError(openaiError(429, 'rate_limit_exceeded', 'Rate limit reached'))
                .kind
        ).toBe('rate_limit')
        expect(
            classifyProviderError(anthropicError(529, 'overloaded_error', 'Overloaded')).kind
        ).toBe('overloaded')
    })

    it('reads errors wrapped by p-retry and timeouts', () => {
        const wrapped = { originalError: openaiError(401, 'invalid_api_key', 'bad key') }
        expect(classifyProviderError(wrapped).kind).toBe('bad_key')
        const timeout = Object.assign(new Error('The operation timed out'), {
            name: 'TimeoutError',
        })
        expect(classifyProviderError(timeout).kind).toBe('timeout')
    })

    it('does not guess from loose text when there is no status or code', () => {
        expect(classifyProviderError(new Error('something was not found in the cache')).kind).toBe(
            'unknown'
        )
    })

    it('recognises the unknown-model answers providers really send (probed 2026-11-21)', () => {
        const model = 'december-nonexistent-model-619'
        const cases: [number, unknown][] = [
            [400, { error: { message: `${model} is not a valid model ID`, code: 400 } }],
            [
                400,
                {
                    error: {
                        message: `body.model : Value error, Input '${model}' should be one of sarvam-105b`,
                    },
                },
            ],
            [400, { error: { message: 'The requested model is invalid or no longer supported.' } }],
            [
                400,
                { error: { code: '1211', message: 'Unknown Model, please check the model code.' } },
            ],
            [
                404,
                {
                    error: {
                        message: `model '${model}' not found, make sure the correct model ID was used`,
                    },
                },
            ],
        ]
        for (const [status, body] of cases) {
            const err = Object.assign(new Error(`${status}`), {
                status,
                error: (body as any).error,
            })
            expect(classifyProviderError(err, model).kind).toBe('model_unavailable')
        }
    })

    it('treats an empty balance answered with 429 as no credits, not a rate limit', () => {
        const moonshot = Object.assign(new Error('429'), {
            status: 429,
            error: {
                message: 'Your account is suspended due to insufficient balance, please recharge',
            },
        })
        const sakana = Object.assign(new Error('429'), {
            status: 429,
            error: { message: 'Prepaid credit balance is exhausted.', type: 'usage_limit_reached' },
        })
        expect(classifyProviderError(moonshot).kind).toBe('no_credits')
        expect(classifyProviderError(sakana).kind).toBe('no_credits')
    })
})
