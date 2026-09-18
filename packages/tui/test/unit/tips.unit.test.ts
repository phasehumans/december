import { describe, it, expect, beforeEach } from 'bun:test'

import {
    TIPS,
    getNextTip,
    resetTipSession,
    TIP_COOLDOWN_MS,
    MAX_SESSION_TIPS,
} from '../../src/constants/tips'

describe('CLI Tips System (Unit)', () => {
    beforeEach(() => {
        resetTipSession()
    })

    it('contains curated tips covering only commands, shortcuts, and skills', () => {
        expect(TIPS.length).toBeGreaterThanOrEqual(10)
        for (const tip of TIPS) {
            // Verify all tips are under 75 characters for compact display
            expect(tip.length).toBeLessThanOrEqual(75)
            // Ensure no prompt coaching phrases exist
            expect(tip.toLowerCase()).not.toContain('prompt')
            expect(tip.toLowerCase()).not.toContain('ask the agent')
        }
    })

    it('returns a tip on first call', () => {
        const now = 1000000
        const tip = getNextTip(now)
        expect(tip).toBeString()
        expect(TIPS).toContain(tip!)
    })

    it('returns null if called within cooldown period', () => {
        const t0 = 1000000
        const tip1 = getNextTip(t0)
        expect(tip1).toBeString()

        // 1 minute later (< 3 minutes)
        const t1 = t0 + 60 * 1000
        const tip2 = getNextTip(t1)
        expect(tip2).toBeNull()

        // 2.9 minutes later (< 3 minutes)
        const t2 = t0 + 179 * 1000
        const tip3 = getNextTip(t2)
        expect(tip3).toBeNull()
    })

    it('returns a new tip once cooldown period has elapsed', () => {
        const t0 = 1000000
        const tip1 = getNextTip(t0)
        expect(tip1).toBeString()

        // Exactly 3 minutes later
        const t1 = t0 + TIP_COOLDOWN_MS
        const tip2 = getNextTip(t1)
        expect(tip2).toBeString()
        expect(tip2).not.toBe(tip1)
    })

    it('enforces maximum session cap of 4 tips', () => {
        let currentTime = 1000000
        const collectedTips: string[] = []

        for (let i = 0; i < MAX_SESSION_TIPS; i++) {
            const tip = getNextTip(currentTime)
            expect(tip).toBeString()
            collectedTips.push(tip!)
            currentTime += TIP_COOLDOWN_MS + 1000
        }

        expect(collectedTips.length).toBe(MAX_SESSION_TIPS)

        // 5th attempt after cooldown should return null due to session cap
        currentTime += TIP_COOLDOWN_MS + 1000
        const fifthTip = getNextTip(currentTime)
        expect(fifthTip).toBeNull()
    })

    it('resets session count and cooldown with resetTipSession', () => {
        let currentTime = 1000000
        for (let i = 0; i < MAX_SESSION_TIPS; i++) {
            getNextTip(currentTime)
            currentTime += TIP_COOLDOWN_MS + 1000
        }

        // Cap reached
        expect(getNextTip(currentTime)).toBeNull()

        // Reset
        resetTipSession()

        // Should now allow tips again
        const freshTip = getNextTip(currentTime)
        expect(freshTip).toBeString()
    })

    it('does not repeat seen tips within the same session', () => {
        let currentTime = 1000000
        const seen = new Set<string>()

        for (let i = 0; i < Math.min(MAX_SESSION_TIPS, TIPS.length); i++) {
            const tip = getNextTip(currentTime)
            expect(tip).toBeString()
            expect(seen.has(tip!)).toBeFalse()
            seen.add(tip!)
            currentTime += TIP_COOLDOWN_MS + 1000
        }
    })
})
