import crypto from 'crypto'

import { DEFAULT_IDLE_STOP_MINUTES, IDLE_STOP_MINUTES } from '@december/shared'

import { env } from '../../env'

import { preferencesSchema } from './setting.schema'

import type {
    DataExportState,
    DataExportStatus,
    OnboardingStep,
    Preferences,
    SandboxSettings,
} from './setting.types'

export const sanitizeMarkdown = (str: string): string => {
    return str
        .replace(/[\r\n]+/g, ' ') // replace newlines with spaces to prevent log/section breakout
        .replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1') // escape all markdown special characters
}

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

/** one export a day (#636) */
export const DATA_EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000
/** the emailed link works this long */
export const DATA_EXPORT_LINK_MS = 7 * 24 * 60 * 60 * 1000

export const dataExportFileKey = (userId: string, exportId: string) =>
    `exports/${userId}/${exportId}.zip`

const dataExportSecret = () =>
    `data-export:${process.env.ACCESS_TOKEN_SECRET ?? env.ACCESS_TOKEN_SECRET}`

/** the token in the emailed link. it only opens this one export, and only until it expires */
export const createDataExportToken = (exportId: string): string =>
    crypto.createHmac('sha256', dataExportSecret()).update(exportId).digest('hex')

export const isValidDataExportToken = (exportId: string, token: string): boolean => {
    const expected = Buffer.from(createDataExportToken(exportId), 'utf8')
    const given = Buffer.from(token, 'utf8')
    return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export const buildDataExportUrl = (exportId: string): string => {
    const serverUrl = (process.env.SERVER_URL ?? env.SERVER_URL).replace(/\/+$/, '')
    const query = new URLSearchParams({ t: createDataExportToken(exportId) })
    return `${serverUrl}/api/v1/setting/export/${exportId}/download?${query.toString()}`
}

export const toDataExportState = (data: {
    id: string
    status: string
    createdAt: Date
    expiresAt: Date | null
}): DataExportState => ({
    id: data.id,
    status: data.status as DataExportStatus,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    nextAllowedAt:
        data.status === 'FAILED'
            ? data.createdAt
            : new Date(data.createdAt.getTime() + DATA_EXPORT_COOLDOWN_MS),
})

/** "0001-fix-the-login-page.json": the order the sessions were made in, then the title */
export const dataExportSessionFileName = (index: number, title: string | null): string => {
    const slug = (title ?? 'session')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
    return `sessions/${String(index + 1).padStart(4, '0')}-${slug || 'session'}.json`
}

const ARCHIVE_AFTER_DAYS = [7, 30] as const

/** the saved sandbox settings of a user; a value that is not a choice becomes the default */
export const toSandboxSettings = (data: {
    idleStopMinutes: number
    archiveAfterDays: number | null
    repositorySettings: Array<{ repoFullName: string; setupCommands: string }>
}): SandboxSettings => ({
    // the choices are the same as in the worker's idle sweep (packages/shared, run-contract.ts)
    idleStopMinutes:
        IDLE_STOP_MINUTES.find((value) => value === data.idleStopMinutes) ??
        DEFAULT_IDLE_STOP_MINUTES,
    archiveAfterDays: ARCHIVE_AFTER_DAYS.find((value) => value === data.archiveAfterDays) ?? null,
    setupCommands: data.repositorySettings.map((row) => ({
        repoFullName: row.repoFullName,
        commands: row.setupCommands,
    })),
})

/** setup commands as they are saved: unix line ends, no empty lines around the text */
export const cleanSetupCommands = (commands: string): string =>
    commands.replace(/\r\n?/g, '\n').trim()
