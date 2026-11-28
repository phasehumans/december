import { describe, it, expect } from 'bun:test'

import * as settingUtils from '../../src/modules/setting/setting.utils'

const { toOnboardingStep, toPreferences } = settingUtils

describe('Setting Utils - Unit Tests', () => {
    describe('toOnboardingStep', () => {
        it('keeps each current step', () => {
            for (const step of ['github', 'start', 'models'] as const) {
                expect(toOnboardingStep(step)).toBe(step)
            }
        })

        it('reads null, an empty string, an old step or a near miss as null', () => {
            for (const value of [null, '', 'welcome', 'GITHUB', ' github', 'github ']) {
                expect(toOnboardingStep(value)).toBeNull()
            }
        })
    })

    describe('toPreferences', () => {
        it('is null when nothing valid is saved', () => {
            for (const value of [
                null,
                undefined,
                {},
                [],
                ['enter'],
                'enter',
                42,
                true,
                { sendKey: 'space' },
                { unknown: true },
            ]) {
                expect(toPreferences(value)).toBeNull()
            }
        })

        it('keeps every valid value', () => {
            expect(
                toPreferences({
                    sendKey: 'mod-enter',
                    soundOnFinish: false,
                    messageWhileWorking: 'send',
                })
            ).toEqual({ sendKey: 'mod-enter', soundOnFinish: false, messageWhileWorking: 'send' })
        })

        it('drops a bad or old value one by one, so it does not hide the others', () => {
            expect(
                toPreferences({
                    sendKey: 'enter',
                    soundOnFinish: 'yes',
                    messageWhileWorking: 'queue',
                    theme: 'dark',
                })
            ).toEqual({ sendKey: 'enter', messageWhileWorking: 'queue' })
        })

        it('does not take values from the prototype', () => {
            const saved = Object.create({ sendKey: 'enter' }) as object
            expect(toPreferences(saved)).toBeNull()
            expect(toPreferences(JSON.parse('{"__proto__": {"sendKey": "enter"}}'))).toBeNull()
        })
    })

    it('has no markdown helper any more (it had no caller)', () => {
        expect('sanitizeMarkdown' in settingUtils).toBe(false)
    })
})
