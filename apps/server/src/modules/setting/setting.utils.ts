import { DEFAULT_IDLE_STOP_MINUTES, IDLE_STOP_MINUTES } from '@december/shared'

import { preferencesSchema } from './setting.schema'

import type { OnboardingStep, Preferences, SandboxSettings } from './setting.types'

const ONBOARDING_STEPS: OnboardingStep[] = ['github', 'start', 'models']

/** a saved step name, or null for anything that is not a current step */
export const toOnboardingStep = (value: string | null): OnboardingStep | null =>
    ONBOARDING_STEPS.find((step) => step === value) ?? null

/**
 * The preferences saved on the account, or null when none are saved. Only valid keys are
 * kept, one by one, so a value from an older schema does not hide the others.
 */
export const toPreferences = (value: unknown): Partial<Preferences> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const saved: Partial<Preferences> = {}
    for (const [key, entry] of Object.entries(value)) {
        const parsed = preferencesSchema.safeParse({ [key]: entry })
        if (parsed.success) Object.assign(saved, parsed.data)
    }
    return Object.keys(saved).length > 0 ? saved : null
}

const ARCHIVE_AFTER_DAYS = [7, 30] as const

/** the saved sandbox settings of a user; a value that is not a choice becomes the default */
export const toSandboxSettings = (data: {
    idleStopMinutes: number
    archiveAfterDays: number | null
}): SandboxSettings => ({
    // the choices are the same as in the worker's idle sweep (packages/shared, run-contract.ts)
    idleStopMinutes:
        IDLE_STOP_MINUTES.find((value) => value === data.idleStopMinutes) ??
        DEFAULT_IDLE_STOP_MINUTES,
    archiveAfterDays: ARCHIVE_AFTER_DAYS.find((value) => value === data.archiveAfterDays) ?? null,
})
