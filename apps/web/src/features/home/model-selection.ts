import { create } from 'zustand'

/** how a cloud run pays for model tokens: december credits, or the user's own key */
export type BillingSource = 'CREDITS' | 'OWN_KEY'

/**
 * Fast or Deep. On December credits the server picks the model for the speed, so the
 * browser holds no model for credits. On the user's own key the speed is how much the
 * picked model reasons.
 */
export type Speed = 'fast' | 'deep'

export const SPEEDS: readonly Speed[] = ['fast', 'deep']

export const SPEED_LABELS: Record<Speed, string> = { fast: 'Fast', deep: 'Deep' }

export const DEFAULT_SPEED: Speed = 'deep'

/** december credits. the model and the provider are set only on the user's own key */
export const DEFAULT_SELECTION = {
    model: '',
    provider: '',
    source: 'CREDITS' as BillingSource,
}

interface ModelChoice {
    model: string
    provider: string
    source: BillingSource
}

interface ModelSelectionState extends ModelChoice {
    speed: Speed
    /** true once the user picked a model; a saved default never overrides that */
    userChosen: boolean
    /** true once the user picked a speed in a prompt box; the account default then stays out */
    speedChosen: boolean
    /** the last model used on a key, so the switch back from credits restores it */
    lastOwnKey: { model: string; provider: string } | null
    select: (selection: ModelChoice) => void
    setSpeed: (speed: Speed) => void
    applyDefault: (selection: ModelChoice) => void
    /** the speed saved on the account (#637), until the user picks one */
    applyDefaultSpeed: (speed: Speed) => void
    /** the model of the user's keys saved on the account: the switch to "Your keys" uses it */
    applyDefaultOwnKey: (choice: { model: string; provider: string }) => void
    reset: () => void
}

/** credits have no model. a key remembers its model for the switch back */
const toChoice = (selection: ModelChoice) =>
    selection.source === 'OWN_KEY'
        ? {
              ...selection,
              lastOwnKey: { model: selection.model, provider: selection.provider },
          }
        : { ...DEFAULT_SELECTION }

/**
 * The payment source, the model of the user's own key and the speed picked in any
 * prompt box. The home prompt and the in-session prompt both read and write it, and
 * every prompt sent over the socket uses it, so the choice carries from the home page
 * into the session.
 */
export const useModelSelection = create<ModelSelectionState>()((set) => ({
    ...DEFAULT_SELECTION,
    speed: DEFAULT_SPEED,
    userChosen: false,
    speedChosen: false,
    lastOwnKey: null,
    select: (selection) => set({ ...toChoice(selection), userChosen: true }),
    setSpeed: (speed) => set({ speed, speedChosen: true }),
    applyDefault: (selection) =>
        set((state) => (state.userChosen ? state : { ...state, ...toChoice(selection) })),
    applyDefaultSpeed: (speed) =>
        set((state) => (state.speedChosen || state.speed === speed ? state : { ...state, speed })),
    applyDefaultOwnKey: (choice) =>
        set((state) =>
            state.userChosen ||
            (state.lastOwnKey?.model === choice.model &&
                state.lastOwnKey?.provider === choice.provider)
                ? state
                : { ...state, lastOwnKey: choice }
        ),
    reset: () =>
        set({
            ...DEFAULT_SELECTION,
            speed: DEFAULT_SPEED,
            userChosen: false,
            speedChosen: false,
            lastOwnKey: null,
        }),
}))

export const getModelSelection = () => {
    const { model, provider, source, speed } = useModelSelection.getState()
    return { model, provider, source, speed }
}
