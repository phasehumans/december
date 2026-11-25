import { create } from 'zustand'

/**
 * Preferences (N10-C): the key that sends a prompt, the finish sound, and what a message
 * sent during a run does. localStorage keeps them for this browser, and the account keeps
 * them across devices (#636, see useAccountPreferencesSync).
 */
export type SendKey = 'enter' | 'mod-enter'
export type MessageWhileWorking = 'queue' | 'send'

export interface Preferences {
    /** 'enter': Enter sends, Shift Enter is a new line. 'mod-enter': Ctrl or Cmd Enter sends */
    sendKey: SendKey
    soundOnFinish: boolean
    /** the web form of the CLI steeringMode: queue a message sent during a run, or send it now (#637) */
    messageWhileWorking: MessageWhileWorking
}

export const BASE_PREFERENCES: Preferences = {
    sendKey: 'enter',
    soundOnFinish: false,
    messageWhileWorking: 'queue',
}

/** only the valid values of a saved object, so bad data falls back to the base values */
export const pickPreferences = (saved: Partial<Record<keyof Preferences, unknown>>) => {
    const picked: Partial<Preferences> = {}
    if (saved.sendKey === 'enter' || saved.sendKey === 'mod-enter') picked.sendKey = saved.sendKey
    if (typeof saved.soundOnFinish === 'boolean') picked.soundOnFinish = saved.soundOnFinish
    if (saved.messageWhileWorking === 'queue' || saved.messageWhileWorking === 'send') {
        picked.messageWhileWorking = saved.messageWhileWorking
    }
    return picked
}

const STORAGE_KEY = 'december:preferences'

const readPreferences = (): Preferences => {
    if (typeof window === 'undefined') return BASE_PREFERENCES
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return BASE_PREFERENCES
        return { ...BASE_PREFERENCES, ...pickPreferences(JSON.parse(raw)) }
    } catch {
        // Intentionally swallowed: storage can be blocked or hold bad data, base values are used
        return BASE_PREFERENCES
    }
}

interface PreferencesState extends Preferences {
    setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
    /** puts values saved on the account into this browser */
    applyPreferences: (values: Partial<Preferences>) => void
}

const writePreferences = (values: Preferences) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {
        // Intentionally swallowed: storage can be blocked, the value then lasts for this tab
    }
}

const currentValues = (state: PreferencesState): Preferences => ({
    sendKey: state.sendKey,
    soundOnFinish: state.soundOnFinish,
    messageWhileWorking: state.messageWhileWorking,
})

export const usePreferences = create<PreferencesState>((set, get) => ({
    ...readPreferences(),
    setPreference: (key, value) => {
        set({ [key]: value } as Pick<Preferences, typeof key>)
        writePreferences(currentValues(get()))
    },
    applyPreferences: (values) => {
        set(values)
        writePreferences(currentValues(get()))
    },
}))

/** the values that are not the base values, to save on an account that has none yet */
export const changedPreferences = (values: Preferences): Partial<Preferences> =>
    Object.fromEntries(
        Object.entries(values).filter(
            ([key, value]) => BASE_PREFERENCES[key as keyof Preferences] !== value
        )
    ) as Partial<Preferences>
