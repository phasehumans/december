import { create } from 'zustand'

/**
 * Configuration for one session, set from the sliders icon in the prompt box
 * (or with /plan). Fast and Deep are not here: they are the model control in the footer.
 *
 * The server does not read these values yet, so the controls only work in demo mode
 * (see connectionsDemo.ts). Nothing here is sent with the prompt.
 */
export interface PromptConfigValues {
    planFirst: boolean
    openPullRequest: boolean
}

export const BASE_PROMPT_CONFIG: PromptConfigValues = {
    planFirst: false,
    openPullRequest: true,
}

const STORAGE_KEY = 'december:prompt-config-defaults'

const readDefaults = (): PromptConfigValues => {
    if (typeof window === 'undefined') return BASE_PROMPT_CONFIG
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return BASE_PROMPT_CONFIG
        const saved = JSON.parse(raw) as Partial<PromptConfigValues>
        return {
            planFirst: Boolean(saved.planFirst),
            openPullRequest: saved.openPullRequest !== false,
        }
    } catch {
        // Intentionally swallowed: storage can be blocked or hold bad data, base values are used
        return BASE_PROMPT_CONFIG
    }
}

interface PromptConfigState {
    values: PromptConfigValues
    defaults: PromptConfigValues
    /** plugins and MCP servers turned off for this session only */
    pluginsOff: string[]
    mcpsOff: string[]
    setValue: <K extends keyof PromptConfigValues>(key: K, value: PromptConfigValues[K]) => void
    saveAsDefault: () => void
    /** the three settings back to the saved defaults ("Reset" in the menu) */
    resetValues: () => void
    /** everything back to the saved defaults, after a prompt is sent */
    reset: () => void
    setPluginOff: (name: string, off: boolean) => void
    setMcpOff: (name: string, off: boolean) => void
}

const toggleName = (list: string[], name: string, off: boolean) =>
    off ? [...new Set([...list, name])] : list.filter((item) => item !== name)

export const usePromptConfig = create<PromptConfigState>((set, get) => {
    const defaults = readDefaults()
    return {
        values: defaults,
        defaults,
        pluginsOff: [],
        mcpsOff: [],
        setValue: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
        saveAsDefault: () => {
            const { values } = get()
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
            } catch {
                // Intentionally swallowed: storage can be blocked, the default then lasts for this tab
            }
            set({ defaults: values })
        },
        resetValues: () => set((s) => ({ values: s.defaults })),
        reset: () => set((s) => ({ values: s.defaults, pluginsOff: [], mcpsOff: [] })),
        setPluginOff: (name, off) =>
            set((s) => ({ pluginsOff: toggleName(s.pluginsOff, name, off) })),
        setMcpOff: (name, off) => set((s) => ({ mcpsOff: toggleName(s.mcpsOff, name, off) })),
    }
})

export const isPromptConfigChanged = (state: Pick<PromptConfigState, 'values' | 'defaults'>) =>
    state.values.planFirst !== state.defaults.planFirst ||
    state.values.openPullRequest !== state.defaults.openPullRequest
