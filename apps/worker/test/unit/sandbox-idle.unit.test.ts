import { describe, expect, it } from 'bun:test'

import { decideIdleSandbox } from '../../src/sandbox-limits'

const MINUTE = 60 * 1000

// #637 section 4: each user picks 10, 30 or 60 minutes. E2B pauses a sandbox 30 minutes
// after its timeout was last set, so a longer idle time needs the timeout pushed forward
describe('decideIdleSandbox', () => {
    const decide = (idleStopMinutes: number, idleMinutes: number, agentWorking = false) =>
        decideIdleSandbox({
            idleStopMinutes,
            idleForMs: idleMinutes * MINUTE,
            agentWorking,
        })

    describe('a user on 10 minutes', () => {
        it('extends a sandbox that is in use', () => {
            expect(decide(10, 0.5)).toBe('extend')
        })

        it('leaves a sandbox that is idle for less than 10 minutes', () => {
            expect(decide(10, 5)).toBe('leave')
            expect(decide(10, 10)).toBe('leave')
        })

        it('pauses a sandbox that is idle for more than 10 minutes', () => {
            expect(decide(10, 11)).toBe('pause')
        })
    })

    describe('a user on 30 minutes', () => {
        it('extends a sandbox that is in use', () => {
            expect(decide(30, 1)).toBe('extend')
        })

        it('does not pause after 10 minutes', () => {
            expect(decide(30, 5)).toBe('leave')
            expect(decide(30, 11)).toBe('leave')
        })

        it('keeps an idle sandbox alive past the E2B timeout until 30 minutes', () => {
            expect(decide(30, 16)).toBe('extend')
            expect(decide(30, 29)).toBe('extend')
            expect(decide(30, 30)).toBe('extend')
        })

        it('pauses a sandbox that is idle for more than 30 minutes', () => {
            expect(decide(30, 31)).toBe('pause')
        })
    })

    describe('a user on 60 minutes', () => {
        it('extends a sandbox that is in use', () => {
            expect(decide(60, 0)).toBe('extend')
        })

        it('does not pause after 10 or 30 minutes', () => {
            expect(decide(60, 11)).toBe('leave')
            expect(decide(60, 31)).toBe('extend')
        })

        it('keeps an idle sandbox alive past the E2B timeout until 60 minutes', () => {
            expect(decide(60, 16)).toBe('extend')
            expect(decide(60, 45)).toBe('extend')
            expect(decide(60, 59)).toBe('extend')
        })

        it('pauses a sandbox that is idle for more than 60 minutes', () => {
            expect(decide(60, 61)).toBe('pause')
        })
    })

    describe('a working agent', () => {
        it('is not paused at the idle time of the user', () => {
            expect(decide(10, 11, true)).toBe('leave')
            expect(decide(30, 31, true)).toBe('extend')
        })

        it('is paused when the run sent nothing for more than 60 minutes', () => {
            expect(decide(10, 61, true)).toBe('pause')
            expect(decide(60, 61, true)).toBe('pause')
        })
    })

    it('uses 10 minutes for a saved value that is not a choice', () => {
        expect(decide(0, 11)).toBe('pause')
        expect(decide(45, 11)).toBe('pause')
    })
})
