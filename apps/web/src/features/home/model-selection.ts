import { create } from 'zustand'

/** how a cloud run pays for model tokens: december credits, or the user's own key */
export type BillingSource = 'CREDITS' | 'OWN_KEY'

/**
 * On December credits the user picks a speed, not a model. The browser maps the two
 * speeds to models for now. The server will own this mapping (issue 633).
 */
export const CREDIT_TIERS = {
    fast: { model: 'gemini-2.5-flash', provider: 'gemini' },
    deep: { model: 'gemini-2.5-pro', provider: 'gemini' },
} as const

export type CreditTier = keyof typeof CREDIT_TIERS

export const CREDIT_TIER_LABELS: Record<CreditTier, string> = { fast: 'Fast', deep: 'Deep' }

/** any credit model that is not the fast one counts as deep */
export const getCreditTier = (model: string | undefined): CreditTier =>
    model === CREDIT_TIERS.fast.model ? 'fast' : 'deep'

export const DEFAULT_SELECTION = {
    model: CREDIT_TIERS.deep.model as string,
    provider: CREDIT_TIERS.deep.provider as string,
    source: 'CREDITS' as BillingSource,
}

interface ModelChoice {
    model: string
    provider: string
    source: BillingSource
}

interface ModelSelectionState extends ModelChoice {
    /** true once the user picked a model; a saved default never overrides that */
    userChosen: boolean
    /** the last speed used on credits, so the switch back from a key restores it */
    lastCreditTier: CreditTier
    /** the last model used on a key, so the switch back from credits restores it */
    lastOwnKey: { model: string; provider: string } | null
    select: (selection: ModelChoice) => void
    applyDefault: (selection: ModelChoice) => void
    reset: () => void
}

const remember = (selection: ModelChoice) =>
    selection.source === 'OWN_KEY'
        ? { lastOwnKey: { model: selection.model, provider: selection.provider } }
        : { lastCreditTier: getCreditTier(selection.model) }

/**
 * The model picked in any prompt box. The home prompt and the in-session prompt both
 * read and write it, and every prompt sent over the socket uses it, so the choice
 * carries from the home page into the session.
 */
export const useModelSelection = create<ModelSelectionState>()((set) => ({
    ...DEFAULT_SELECTION,
    userChosen: false,
    lastCreditTier: 'deep',
    lastOwnKey: null,
    select: (selection) => set({ ...selection, ...remember(selection), userChosen: true }),
    applyDefault: (selection) =>
        set((state) =>
            state.userChosen ? state : { ...state, ...selection, ...remember(selection) }
        ),
    reset: () =>
        set({ ...DEFAULT_SELECTION, userChosen: false, lastCreditTier: 'deep', lastOwnKey: null }),
}))

export const getModelSelection = () => {
    const { model, provider, source } = useModelSelection.getState()
    return { model, provider, source }
}
