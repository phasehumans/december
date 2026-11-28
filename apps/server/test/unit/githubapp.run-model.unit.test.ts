import { afterEach, describe, expect, it } from 'bun:test'

import {
    minRunStartBalanceInCents,
    pickRunnableOwnKey,
} from '../../src/modules/githubapp/githubapp.utils'

// a github run pays with December credits; with no credits left it falls back to a saved key
describe('github run model source helpers', () => {
    const original = process.env.MIN_SESSION_START_BALANCE_IN_CENTS

    afterEach(() => {
        if (original === undefined) delete process.env.MIN_SESSION_START_BALANCE_IN_CENTS
        else process.env.MIN_SESSION_START_BALANCE_IN_CENTS = original
    })

    describe('minRunStartBalanceInCents', () => {
        it('is 50 cents by default, like a session start', () => {
            delete process.env.MIN_SESSION_START_BALANCE_IN_CENTS
            expect(minRunStartBalanceInCents()).toBe(50)
        })

        it('reads the same env value as a session start', () => {
            process.env.MIN_SESSION_START_BALANCE_IN_CENTS = '200'
            expect(minRunStartBalanceInCents()).toBe(200)
        })

        it('falls back to 50 for a value that is not a number', () => {
            process.env.MIN_SESSION_START_BALANCE_IN_CENTS = 'lots'
            expect(minRunStartBalanceInCents()).toBe(50)
        })
    })

    describe('pickRunnableOwnKey', () => {
        it('takes the first key (the one used last) whose default model it still serves', () => {
            expect(
                pickRunnableOwnKey([
                    { provider: 'anthropic', defaultModel: 'm-1', models: ['m-1'] },
                    { provider: 'groq', defaultModel: 'g-1', models: ['g-1'] },
                ])
            ).toEqual({ provider: 'anthropic', model: 'm-1' })
        })

        it('skips keys that cannot run', () => {
            expect(
                pickRunnableOwnKey([
                    { provider: 'openai', defaultModel: 'gone', models: ['other'] },
                    { provider: 'xai', defaultModel: '', models: [''] },
                    { provider: 'mistral', defaultModel: 'm', models: null },
                    { provider: 'groq', defaultModel: 'g-1', models: ['g-0', 'g-1'] },
                ])
            ).toEqual({ provider: 'groq', model: 'g-1' })
        })

        it('is null with no key that can run', () => {
            expect(pickRunnableOwnKey([])).toBeNull()
            expect(
                pickRunnableOwnKey([{ provider: 'openai', defaultModel: 'gone', models: [] }])
            ).toBeNull()
        })
    })
})
