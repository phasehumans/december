import { create } from 'zustand'

/**
 * Preferences of this browser (N10-C): the key that sends a prompt, and the finish sound.
 * They live in localStorage. Saving them to the account is server work (issue 636).
 */
export type SendKey = 'enter' | 'mod-enter'

export interface Preferences {
    /** 'enter': Enter sends, Shift Enter is a new line. 'mod-enter': Ctrl or Cmd Enter sends */
    sendKey: SendKey
    soundOnFinish: boolean
}

export const BASE_PREFERENCES: Preferences = {
    sendKey: 'enter',
    soundOnFinish: false,
}

const STORAGE_KEY = 'december:preferences'

const readPreferences = (): Preferences => {
    if (typeof window === 'undefined') return BASE_PREFERENCES
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return BASE_PREFERENCES
        const saved = JSON.parse(raw) as Partial<Preferences>
        return {
            sendKey: saved.sendKey === 'mod-enter' ? 'mod-enter' : 'enter',
            soundOnFinish: saved.soundOnFinish === true,
        }
    } catch {
        // Intentionally swallowed: storage can be blocked or hold bad data, base values are used
        return BASE_PREFERENCES
    }
}

interface PreferencesState extends Preferences {
    setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

export const usePreferences = create<PreferencesState>((set, get) => ({
    ...readPreferences(),
    setPreference: (key, value) => {
        set({ [key]: value } as Pick<Preferences, typeof key>)
        const { sendKey, soundOnFinish } = get()
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sendKey, soundOnFinish }))
        } catch {
            // Intentionally swallowed: storage can be blocked, the value then lasts for this tab
        }
    },
}))
