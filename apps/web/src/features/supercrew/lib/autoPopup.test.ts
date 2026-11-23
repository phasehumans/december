import { describe, expect, test } from 'bun:test'

import { shouldAutoOpenSuperCrew } from './autoPopup'

import type { WaitlistState } from '../api/waitlist'

const state = (patch: Partial<WaitlistState> = {}): WaitlistState => ({
    feature: 'super-crew',
    joined: false,
    joinedAt: null,
    popupSeen: false,
    canShowPopup: true,
    ...patch,
})

const base = { isAuthenticated: true, isHome: true, isOpen: false, isPhone: false, state: state() }

describe('shouldAutoOpenSuperCrew', () => {
    test('opens on home when the server allows it', () => {
        expect(shouldAutoOpenSuperCrew(base)).toBe(true)
    })

    test('stays closed when already seen or onboarding is not done', () => {
        expect(shouldAutoOpenSuperCrew({ ...base, state: state({ canShowPopup: false }) })).toBe(
            false
        )
    })

    test('stays closed off home, signed out, already open or while loading', () => {
        expect(shouldAutoOpenSuperCrew({ ...base, isHome: false })).toBe(false)
        expect(shouldAutoOpenSuperCrew({ ...base, isAuthenticated: false })).toBe(false)
        expect(shouldAutoOpenSuperCrew({ ...base, isOpen: true })).toBe(false)
        expect(shouldAutoOpenSuperCrew({ ...base, isPhone: true })).toBe(false)
        expect(shouldAutoOpenSuperCrew({ ...base, state: undefined })).toBe(false)
    })
})
