import { expect, test, describe } from 'bun:test'

import { parseErrorMessage, parseError } from '../src/utils/error-parser'

describe('error-parser', () => {
    test('extracts simple error string', () => {
        expect(parseErrorMessage('Simple error')).toBe('Simple error')
    })

    test('extracts error from standard Error object', () => {
        expect(parseErrorMessage(new Error('Standard error'))).toBe('Standard error')
    })

    test('extracts message from JSON string', () => {
        expect(parseErrorMessage('{"message": "JSON error"}')).toBe('JSON error')
        expect(parseErrorMessage('{"error": "JSON error"}')).toBe('JSON error')
        expect(parseErrorMessage('{"error": {"message": "Nested JSON error"}}')).toBe(
            'Nested JSON error'
        )
    })

    test('extracts message from complex JSON string', () => {
        const complexStr = 'Some text before {"error": {"message": "Extracted error"}} text after'
        expect(parseErrorMessage(complexStr)).toBe('Extracted error')
    })

    test('extracts from double nested JSON string', () => {
        expect(
            parseErrorMessage('{"error": "{\\"message\\": \\"Double nested JSON error\\"}"}')
        ).toBe('Double nested JSON error')
    })

    test('extracts from regex when JSON is malformed', () => {
        const malformed = 'Oops! {"message": "Malformed JSON error"' // missing closing brace
        expect(parseErrorMessage(malformed)).toBe('Malformed JSON error')
    })

    test('regex extraction handles exceptions', () => {
        // Line 21-22: exception in JSON.parse of regex match
        const malformedRegexMatch = '{"message": "broken\\"escape"}'
        expect(parseErrorMessage(malformedRegexMatch)).toBe('broken"escape')
    })

    test('recursively parses json error fields', () => {
        // Line 36-37: deeply nested json inside error/message fields
        expect(parseErrorMessage('{"message": "{\\"error\\": {\\"message\\": \\"deep\\"}}"}')).toBe(
            'deep'
        )

        expect(parseErrorMessage('{"error": "{\\"message\\": \\"deep error\\"}"}')).toBe(
            'deep error'
        )
    })

    test('extracts from json block', () => {
        // Line 51-57: fallback json block extraction
        const blockStr = 'prefix {"error": {"message": "block error"}} suffix'
        expect(parseErrorMessage(blockStr)).toBe('block error')

        const blockStr2 = 'prefix {"message": "block message"} suffix'
        expect(parseErrorMessage(blockStr2)).toBe('block message')
    })

    test('falls back to util.inspect for complex objects without message', () => {
        const obj = { foo: 'bar', baz: 42 }
        const parsed = parseErrorMessage(obj)
        expect(parsed).toContain("foo: 'bar'")
        expect(parsed).toContain('baz: 42')
    })

    test('cleans up [Error] prefixes', () => {
        expect(parseErrorMessage('[ModuleError]: Real error message')).toBe('Real error message')
    })

    test('handles null or undefined gracefully', () => {
        expect(parseErrorMessage(null)).toBe('null')
        expect(parseErrorMessage(undefined)).toBe('undefined')
    })

    test('stringifies non-string error messages', () => {
        // Line 7: JSON.stringify(errMsg)
        const customErr = {
            message: { something: 'weird' },
        }
        expect(parseErrorMessage(customErr)).toContain('{"something":"weird"}')
    })

    test('handles top-level catch gracefully', () => {
        // Line 9: return 'Unknown error occurred.'
        const badObj = Object.create(null)
        Object.defineProperty(badObj, 'message', {
            get() {
                throw new Error('Cannot read')
            },
        })
        expect(parseErrorMessage(badObj)).toBe('Unknown error occurred.')
    })

    test('preserves CTA links in error messages', () => {
        const ctaErr =
            'Insufficient credits in December Wallet. Please add credits at https://trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.'
        expect(parseErrorMessage(ctaErr)).toBe(ctaErr)
    })

    test('does not attach OpenRouter notice to December Wallet 402 error', () => {
        const decemberWallet402 =
            '402 Insufficient credits in December Wallet. Please add credits at https://trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.\n402 status code (no body)'
        const parsed = parseErrorMessage(decemberWallet402)
        expect(parsed).not.toContain('OpenRouter credits exhausted or insufficient')
        expect(parsed).not.toContain('https://openrouter.ai/settings/credits')
        expect(parsed).toContain('Insufficient credits in December Wallet')
        expect(parsed).toContain('https://trydecember.com/settings/billing')
        expect(parsed).toContain('Bring Your Own Key (BYOK)')
    })

    test('attaches custom December rate limit notice when rate limit/quota is exhausted', () => {
        const rawQuotaErr =
            'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash'
        const parsed = parseErrorMessage(rawQuotaErr)
        expect(parsed).toContain(
            'Rate limit or quota exhausted from LLM provider. Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://trydecember.com/pricing'
        )
        expect(parsed).toContain('generativelanguage.googleapis.com')
    })

    test('attaches OpenRouter credit notice when 402 or credit limit is exhausted', () => {
        const raw402Err =
            '402 This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 10666. To increase, visit https://openrouter.ai/settings/credits and upgrade to a paid account'
        const parsed = parseErrorMessage(raw402Err)
        expect(parsed).toContain('https://openrouter.ai/settings/credits')
        expect(parsed).toContain('can only afford 10666')
        expect(parsed).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u)
    })

    test('attaches Arcee credit notice when 402 or credit limit is exhausted on Arcee', () => {
        const raw402Err = '402 Insufficient credits. Arcee model trinity-large-thinking'
        const parsed = parseErrorMessage(raw402Err)
        expect(parsed).toContain('https://platform.arcee.ai/api/api-keys')
        expect(parsed).toContain('Insufficient credits in your Arcee AI account')
        expect(parsed).not.toContain('December Wallet')
    })

    test('attaches Meta credit notice when 402 or credit limit is exhausted on Meta', () => {
        const raw402Err = '402 Insufficient credits. Meta model muse-spark-1.3'
        const parsed = parseErrorMessage(raw402Err)
        expect(parsed).toContain('https://dev.meta.ai/')
        expect(parsed).toContain('Insufficient credits in your Meta account')
        expect(parsed).not.toContain('December Wallet')
    })

    test('attaches authentication notice when 401 or session expired error occurs', () => {
        const raw401Err = '401 status code (no body)'
        const parsed = parseErrorMessage(raw401Err)
        expect(parsed).toContain('Authentication failed or session expired')
        expect(parsed).toContain('/login')
        expect(parsed).toContain('Bring Your Own Key (BYOK)')
    })

    test('attaches MiniMax balance notice when 1008 or insufficient balance is encountered', () => {
        const rawErr = 'insufficient balance (1008)'
        const parsed = parseErrorMessage(rawErr)
        expect(parsed).toContain('https://platform.minimax.io/')
        expect(parsed).toContain('Insufficient balance in your MiniMax account')
        expect(parsed).toContain('insufficient balance (1008)')
    })

    test('attaches DeepSeek balance notice when balance is exhausted on DeepSeek', () => {
        const rawErr = '402 Insufficient Balance from https://api.deepseek.com'
        const parsed = parseErrorMessage(rawErr)
        expect(parsed).toContain('https://platform.deepseek.com/top_up')
        expect(parsed).toContain('Insufficient balance in your DeepSeek account')
    })

    test('attaches SiliconFlow balance notice when code 20009 is encountered', () => {
        const rawErr = '{"code": 20009, "message": "balance insufficient"}'
        const parsed = parseErrorMessage(rawErr)
        expect(parsed).toContain('https://cloud.siliconflow.cn/')
        expect(parsed).toContain('Insufficient balance in your SiliconFlow account')
    })

    test('attaches universal fallback notice when an unknown provider returns 402 or balance error', () => {
        const rawErr = '402 Payment Required: account balance is empty'
        const parsed = parseErrorMessage(rawErr)
        expect(parsed).toContain('Insufficient balance or credits with your LLM provider')
        expect(parsed).toContain('/model')
    })

    test('uses context provider to identify provider when error message lacks provider name', () => {
        const rawErr = 'insufficient balance'
        const parsed = parseErrorMessage(rawErr, { provider: 'minimax', model: 'MiniMax-M3' })
        expect(parsed).toContain('https://platform.minimax.io/')
        expect(parsed).toContain('Insufficient balance in your MiniMax account')
    })

    describe('parseError (Structured Extraction)', () => {
        test('extracts custom message and underlying cause from Error with cause', () => {
            const causeErr = new Error('listen EADDRINUSE: address already in use :::53692')
            const customErr = new Error('Failed to start Claude OAuth callback server', {
                cause: causeErr,
            })
            const parsed = parseError(customErr)
            expect(parsed.message).toBe('Failed to start Claude OAuth callback server')
            expect(parsed.cause).toContain('EADDRINUSE')
            expect(parsed.hint).toContain('port')
            expect(JSON.stringify(parsed)).not.toContain('✖')
            expect(JSON.stringify(parsed)).not.toContain('↳')
            expect(JSON.stringify(parsed)).not.toContain('ℹ')
        })

        test('extracts cause from originalError property', () => {
            const customErr = {
                message: 'Failed to run tool',
                originalError: new Error('Permission denied: /var/log/app.log'),
            }
            const parsed = parseError(customErr)
            expect(parsed.message).toBe('Failed to run tool')
            expect(parsed.cause).toContain('Permission denied')
            expect(parsed.hint).toContain('permissions')
        })

        test('extracts structured details from rate limit errors', () => {
            const rawQuotaErr =
                'You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com, limit: 20, 429'
            const parsed = parseError(rawQuotaErr)
            expect(parsed.message).toBe('Rate limit or quota exhausted from LLM provider.')
            expect(parsed.cause).toContain('generativelanguage.googleapis.com')
            expect(parsed.hint).toContain('https://trydecember.com/pricing')
        })

        test('extracts structured details from OpenRouter 402 credits errors', () => {
            const raw402Err =
                '402 This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 10666. To increase, visit https://openrouter.ai/settings/credits'
            const parsed = parseError(raw402Err)
            expect(parsed.message).toBe('OpenRouter credits exhausted or insufficient.')
            expect(parsed.cause).toContain('can only afford 10666')
            expect(parsed.hint).toBe('Please add credits at https://openrouter.ai/settings/credits')
        })

        test('extracts structured details from MiniMax 1008 insufficient balance error', () => {
            const raw1008Err = 'insufficient balance (1008)'
            const parsed = parseError(raw1008Err)
            expect(parsed.message).toBe('Insufficient balance in your MiniMax account.')
            expect(parsed.cause).toContain('1008')
            expect(parsed.hint).toContain('https://platform.minimax.io/')
        })

        test('extracts structured details from universal fallback balance error', () => {
            const rawErr = '402 Payment Required: custom provider out of credits'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient balance or credits with your LLM provider.')
            expect(parsed.cause).toContain('custom provider out of credits')
            expect(parsed.hint).toContain('/model')
        })

        test('extracts structured details using context provider', () => {
            const rawErr = 'balance insufficient'
            const parsed = parseError(rawErr, { provider: 'deepseek' })
            expect(parsed.message).toBe('Insufficient balance in your DeepSeek account.')
            expect(parsed.hint).toContain('https://platform.deepseek.com/top_up')
        })

        test('extracts structured details from 401 authentication errors', () => {
            const raw401Err = '401 Unauthorized: Invalid API key'
            const parsed = parseError(raw401Err)
            expect(parsed.message).toBe('Authentication failed or session expired.')
            expect(parsed.cause).toContain('Invalid API key')
            expect(parsed.hint).toContain('/login')
        })

        test('extracts structured details from 503 overloaded errors', () => {
            const overloadedErr = 'HTTP 503 Service Unavailable: Gemini model overloaded'
            const parsed = parseError(overloadedErr)
            expect(parsed.message).toBe(
                'Model is currently experiencing high demand or capacity limits from the provider.'
            )
            expect(parsed.cause).toContain('503 Service Unavailable')
            expect(parsed.hint).toContain('temporary')
        })

        test('extracts network ECONNREFUSED into cause and hint', () => {
            const netErr = new Error('fetch failed', {
                cause: new Error('connect ECONNREFUSED 127.0.0.1:4000'),
            })
            const parsed = parseError(netErr)
            expect(parsed.message).toBe('fetch failed')
            expect(parsed.cause).toContain('ECONNREFUSED')
            expect(parsed.hint).toContain('server')
        })

        test('attaches custom notice for Sarvam AI credit exhaustion', () => {
            const rawErr = '402 Payment Required: insufficient credits on sarvam'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your Sarvam AI account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://indus.sarvam.ai/'
            )
        })

        test('attaches custom notice for StepFun credit exhaustion', () => {
            const rawErr = '402 out of credits from stepfun'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your StepFun account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://platform.stepfun.ai/interface-key'
            )
        })

        test('attaches custom notice for Upstage Solar credit exhaustion', () => {
            const rawErr = '402 Insufficient credits. Model solar-pro'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your Upstage Solar account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://console.upstage.ai/'
            )
        })

        test('attaches custom notice for Thinking Machines credit exhaustion', () => {
            const rawErr = '402 credits exhausted on tinker'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your Thinking Machines account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://tinker.thinkingmachines.ai/'
            )
        })

        test('attaches custom notice for NVIDIA NIM credit exhaustion', () => {
            const rawErr = '402 credits exhausted on build.nvidia.com'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your NVIDIA NIM account.')
            expect(parsed.hint).toBe('Please check your account at https://build.nvidia.com/')
        })

        test('attaches custom notice for Google AI Studio credit exhaustion', () => {
            const rawErr = '402 Insufficient credits from aistudio.google.com'
            const parsed = parseError(rawErr)
            expect(parsed.message).toBe('Insufficient credits in your Google AI Studio account.')
            expect(parsed.hint).toContain('https://aistudio.google.com/')
        })

        test('dynamically resolves provider from context provider alias when error text lacks provider name', () => {
            const rawErr = '402 Payment Required: account balance is 0'
            const parsed = parseError(rawErr, { provider: 'sarvamai' })
            expect(parsed.message).toBe('Insufficient credits in your Sarvam AI account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://indus.sarvam.ai/'
            )
        })

        test('dynamically resolves provider from model name when error text lacks provider name', () => {
            const rawErr = '402 Payment Required: zero balance'
            const parsed = parseError(rawErr, { model: 'solar-10.7b' })
            expect(parsed.message).toBe('Insufficient credits in your Upstage Solar account.')
            expect(parsed.hint).toBe(
                'Please add credits or top up your balance at https://console.upstage.ai/'
            )
        })

        test('dynamically formats custom provider error with baseURL when available', () => {
            const rawErr = '402 Payment Required: out of credits'
            const parsed = parseError(rawErr, { baseURL: 'https://llm.internal.corp/v1' })
            expect(parsed.message).toBe(
                'Insufficient credits or balance with your custom provider.'
            )
            expect(parsed.hint).toContain('https://llm.internal.corp/v1')
        })
    })
})
