import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

import {
    resolveModelRate,
    fetchLiveModelRates,
    clearRatesCache,
} from '../../src/modules/usage/usage.rates'
import { usageService } from '../../src/modules/usage/usage.service'

describe('Usage Rates & Cost Calculation - Unit Tests', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        clearRatesCache()
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        clearRatesCache()
    })

    describe('resolveModelRate (static catalog)', () => {
        it('resolves official rates for gemini models', () => {
            const flashRate = resolveModelRate('gemini-3.6-flash')
            expect(flashRate.inputRate).toBe(0.1)
            expect(flashRate.outputRate).toBe(0.4)

            const proRate = resolveModelRate('google/gemini-2.5-pro')
            expect(proRate.inputRate).toBe(1.25)
            expect(proRate.outputRate).toBe(5.0)
        })

        it('resolves official rates for claude models', () => {
            const sonnetRate = resolveModelRate('claude-3-7-sonnet')
            expect(sonnetRate.inputRate).toBe(3.0)
            expect(sonnetRate.outputRate).toBe(15.0)

            const haikuRate = resolveModelRate('claude-3-5-haiku-latest')
            expect(haikuRate.inputRate).toBe(0.8)
            expect(haikuRate.outputRate).toBe(4.0)
        })

        it('resolves official rates for openai models', () => {
            const gpt4oRate = resolveModelRate('gpt-4o')
            expect(gpt4oRate.inputRate).toBe(2.5)
            expect(gpt4oRate.outputRate).toBe(10.0)

            const o3Rate = resolveModelRate('o3-mini')
            expect(o3Rate.inputRate).toBe(1.1)
            expect(o3Rate.outputRate).toBe(4.4)
        })

        it('resolves official rates for deepseek models', () => {
            const chatRate = resolveModelRate('deepseek-chat')
            expect(chatRate.inputRate).toBe(0.14)
            expect(chatRate.outputRate).toBe(0.28)

            const r1Rate = resolveModelRate('deepseek-reasoner')
            expect(r1Rate.inputRate).toBe(0.55)
            expect(r1Rate.outputRate).toBe(2.19)
        })

        it('resolves official rates for groq models', () => {
            const llama70bRate = resolveModelRate('llama-3.3-70b-versatile')
            expect(llama70bRate.inputRate).toBe(0.59)
            expect(llama70bRate.outputRate).toBe(0.79)

            const llama8bRate = resolveModelRate('groq/llama-3.1-8b-instant')
            expect(llama8bRate.inputRate).toBe(0.05)
            expect(llama8bRate.outputRate).toBe(0.08)

            const mixtralRate = resolveModelRate('mixtral-8x7b-32768')
            expect(mixtralRate.inputRate).toBe(0.24)
            expect(mixtralRate.outputRate).toBe(0.24)
        })

        it('resolves zero cost for local and free models', () => {
            const ollamaRate = resolveModelRate('ollama/qwen2.5')
            expect(ollamaRate.inputRate).toBe(0)
            expect(ollamaRate.outputRate).toBe(0)

            const localRate = resolveModelRate('local/llama3')
            expect(localRate.inputRate).toBe(0)
            expect(localRate.outputRate).toBe(0)

            const freeRate = resolveModelRate('openai/gpt-oss-20b:free')
            expect(freeRate.inputRate).toBe(0)
            expect(freeRate.outputRate).toBe(0)
        })

        it('falls back to default rates for unknown models', () => {
            const fallback = resolveModelRate('unknown-custom-model')
            expect(fallback.inputRate).toBe(2.0)
            expect(fallback.outputRate).toBe(8.0)
        })

        it('respects custom fallback rate environment variables', () => {
            const originalInput = process.env.FALLBACK_MODEL_INPUT_RATE
            const originalOutput = process.env.FALLBACK_MODEL_OUTPUT_RATE
            process.env.FALLBACK_MODEL_INPUT_RATE = '1.50'
            process.env.FALLBACK_MODEL_OUTPUT_RATE = '6.00'

            try {
                const fallback = resolveModelRate('another-custom-model')
                expect(fallback.inputRate).toBe(1.5)
                expect(fallback.outputRate).toBe(6.0)
            } finally {
                if (originalInput !== undefined) {
                    process.env.FALLBACK_MODEL_INPUT_RATE = originalInput
                } else {
                    delete process.env.FALLBACK_MODEL_INPUT_RATE
                }
                if (originalOutput !== undefined) {
                    process.env.FALLBACK_MODEL_OUTPUT_RATE = originalOutput
                } else {
                    delete process.env.FALLBACK_MODEL_OUTPUT_RATE
                }
            }
        })
    })

    describe('fetchLiveModelRates (dynamic sync)', () => {
        it('fetches and caches live pricing from openrouter models api', async () => {
            const mockResponse = {
                data: [
                    {
                        id: 'meta-llama/llama-3.3-70b-instruct',
                        pricing: {
                            prompt: '0.00000012', // $0.12 / 1M
                            completion: '0.00000030', // $0.30 / 1M
                        },
                    },
                ],
            }

            globalThis.fetch = mock(async () => {
                return new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            }) as any

            await fetchLiveModelRates(true)

            const rate = resolveModelRate('meta-llama/llama-3.3-70b-instruct')
            expect(rate.inputRate).toBeCloseTo(0.12)
            expect(rate.outputRate).toBeCloseTo(0.3)

            // Stripped model name should also work
            const strippedRate = resolveModelRate('llama-3.3-70b-instruct')
            expect(strippedRate.inputRate).toBeCloseTo(0.12)
        })

        it('gracefully handles fetch failures without throwing', async () => {
            globalThis.fetch = mock(async () => {
                throw new Error('Network error')
            }) as any

            await expect(fetchLiveModelRates(true)).resolves.toBeUndefined()
        })
    })

    describe('calculateGenerationCost', () => {
        it('returns 0 if token counts are 0', () => {
            const cost = usageService.calculateGenerationCost({
                modelName: 'gemini-3.6-flash',
                inputTokens: 0,
                outputTokens: 0,
            })
            expect(cost).toBe(0)
        })

        it('calculates accurate cost in cents with sub-cent precision', () => {
            // For gemini-3.6-flash: input = $0.10/1M, output = $0.40/1M
            // 1,000,000 input tokens = $0.10 = 10 cents
            // 1,000,000 output tokens = $0.40 = 40 cents
            const cost = usageService.calculateGenerationCost({
                modelName: 'gemini-3.6-flash',
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
            })
            expect(cost).toBe(50) // 10 + 40 cents
        })

        it('supports exact sub-cent micro-cent tracking for small token batches', () => {
            // For 100 input tokens: 100 * (0.10 / 10,000) = 0.001 cents
            const cost = usageService.calculateGenerationCost({
                modelName: 'gemini-3.6-flash',
                inputTokens: 100,
                outputTokens: 0,
            })
            expect(cost).toBe(0.001)
        })

        it('resolves auto model via DEFAULT_MODEL env variable', () => {
            const originalDefault = process.env.DEFAULT_MODEL
            process.env.DEFAULT_MODEL = 'claude-3-5-haiku'

            try {
                // claude-3-5-haiku: 0.8 input, 4.0 output per 1M tokens
                const cost = usageService.calculateGenerationCost({
                    modelName: 'auto',
                    inputTokens: 10000,
                    outputTokens: 10000,
                })
                // 10000 * 0.8/10000 + 10000 * 4.0/10000 = 0.8 + 4.0 = 4.8 cents
                expect(cost).toBe(4.8)
            } finally {
                if (originalDefault !== undefined) {
                    process.env.DEFAULT_MODEL = originalDefault
                } else {
                    delete process.env.DEFAULT_MODEL
                }
            }
        })

        it('resolves auto model via AUTO_MODEL env variable if DEFAULT_MODEL is unset', () => {
            const originalDefault = process.env.DEFAULT_MODEL
            const originalAuto = process.env.AUTO_MODEL
            delete process.env.DEFAULT_MODEL
            process.env.AUTO_MODEL = 'gemini-3.6-flash'

            try {
                const cost = usageService.calculateGenerationCost({
                    modelName: 'auto',
                    inputTokens: 10000,
                    outputTokens: 10000,
                })
                // 10000 * 0.1/10000 + 10000 * 0.4/10000 = 0.1 + 0.4 = 0.5 cents
                expect(cost).toBe(0.5)
            } finally {
                if (originalDefault !== undefined) process.env.DEFAULT_MODEL = originalDefault
                if (originalAuto !== undefined) {
                    process.env.AUTO_MODEL = originalAuto
                } else {
                    delete process.env.AUTO_MODEL
                }
            }
        })

        it('defaults auto model to free model when neither env var is configured', () => {
            const originalDefault = process.env.DEFAULT_MODEL
            const originalAuto = process.env.AUTO_MODEL
            delete process.env.DEFAULT_MODEL
            delete process.env.AUTO_MODEL

            try {
                const cost = usageService.calculateGenerationCost({
                    modelName: 'auto',
                    inputTokens: 10000,
                    outputTokens: 10000,
                })
                // defaults to openai/gpt-oss-20b:free which has 0 cost
                expect(cost).toBe(0)
            } finally {
                if (originalDefault !== undefined) process.env.DEFAULT_MODEL = originalDefault
                if (originalAuto !== undefined) process.env.AUTO_MODEL = originalAuto
            }
        })

        it('returns 0 cost for local models regardless of token volume', () => {
            const cost = usageService.calculateGenerationCost({
                modelName: 'ollama/llama3.3',
                inputTokens: 50000,
                outputTokens: 25000,
            })
            expect(cost).toBe(0)
        })

        it('calculates cost accurately for groq model family', () => {
            // llama-3.1-8b-instant: 0.05 input / 0.08 output per 1M tokens
            const cost = usageService.calculateGenerationCost({
                modelName: 'llama-3.1-8b-instant',
                inputTokens: 100000,
                outputTokens: 50000,
            })
            // 100000 * 0.05/10000 + 50000 * 0.08/10000 = 0.5 + 0.4 = 0.9 cents
            expect(cost).toBe(0.9)
        })
    })
})
