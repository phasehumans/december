import { create } from 'zustand'

/** how a cloud run pays for model tokens: december credits, or the user's own key */
export type BillingSource = 'CREDITS' | 'OWN_KEY'

export const DEFAULT_SELECTION = {
    model: 'gemini-2.5-pro',
    provider: 'gemini',
    source: 'CREDITS' as BillingSource,
}

interface ModelSelectionState {
    model: string
    provider: string
    source: BillingSource
    /** true once the user picked a model; a saved default never overrides that */
    userChosen: boolean
    select: (selection: { model: string; provider: string; source: BillingSource }) => void
    applyDefault: (selection: { model: string; provider: string; source: BillingSource }) => void
    reset: () => void
}

/**
 * The model picked in any prompt box. The home prompt and the in-session prompt both
 * read and write it, and every prompt sent over the socket uses it, so the choice
 * carries from the home page into the session.
 */
export const useModelSelection = create<ModelSelectionState>()((set) => ({
    ...DEFAULT_SELECTION,
    userChosen: false,
    select: (selection) => set({ ...selection, userChosen: true }),
    applyDefault: (selection) =>
        set((state) => (state.userChosen ? state : { ...state, ...selection })),
    reset: () => set({ ...DEFAULT_SELECTION, userChosen: false }),
}))

export const getModelSelection = () => {
    const { model, provider, source } = useModelSelection.getState()
    return { model, provider, source }
}
