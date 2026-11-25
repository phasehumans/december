import { checkBranchPrefix, isRepoFullName } from '@december/shared'
import { z } from 'zod'

import { isValidTimezone } from '../notification/notification.utils'

export const updateNameSchema = z.object({
    name: z
        .string({ message: 'name is required' })
        .min(3, 'name must be at least 3 characters')
        .max(20, 'name must be at most 20 characters'),
})

// every field is optional: the page saves one row at a time (#636)
export const updateNotificationSchema = z
    .object({
        notifyProductUpdates: z.boolean({ message: 'notifyProductUpdates must be a boolean' }),
        // security alerts stay on: the switch exists, but it cannot be turned off
        notifySecurityAlerts: z.literal(true, { message: 'security alerts cannot be turned off' }),
        notifyLevel: z.enum(['ALL', 'IMPORTANT', 'NONE'], {
            message: 'notifyLevel must be ALL, IMPORTANT or NONE',
        }),
        notifyEmail: z.boolean({ message: 'notifyEmail must be a boolean' }),
        // turning push on goes through POST /notification/push/subscribe; off works here too
        notifyPush: z.literal(false, { message: 'turn push on from the browser' }),
        digestEnabled: z.boolean({ message: 'digestEnabled must be a boolean' }),
        digestTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'digestTime must be HH:mm, from 00:00 to 23:59'),
        timezone: z
            .string()
            .min(1)
            .max(64)
            .refine(isValidTimezone, { message: 'timezone is not a known time zone' }),
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'at least one notification setting must be provided',
    })

export const updateOnboardingSchema = z.object({
    step: z.enum(['github', 'start', 'models'], {
        message: 'step must be github, start or models',
    }),
})

export const submitFeedbackSchema = z.object({
    rating: z.enum(['sad', 'neutral', 'happy']).nullable(),
    feedback: z.string({ message: 'feedback is required' }).min(1, 'feedback cannot be empty'),
})

export const updateModelSourceSchema = z.object({
    defaultModelSource: z.enum(['CREDITS', 'OWN_KEY'], {
        message: 'defaultModelSource must be CREDITS or OWN_KEY',
    }),
})

// defaults for a new session (#632, #637). every field is optional: the page saves one row
// at a time
export const updateSessionDefaultsSchema = z
    .object({
        defaultPlanFirst: z.boolean(),
        defaultEffort: z.enum(['fast', 'deep'], {
            message: 'defaultEffort must be fast or deep',
        }),
        defaultOpenPullRequest: z.boolean(),
        // the model a new session uses on the user's own key. null for both: no default
        defaultOwnKeyProvider: z.string().trim().min(1).max(64).nullable(),
        defaultOwnKeyModel: z.string().trim().min(1).max(200).nullable(),
        // 'last-used', or the full name of a repository (owner/name, or a gitlab group path)
        defaultRepository: z
            .string()
            .trim()
            .max(200, 'defaultRepository must be at most 200 characters')
            .regex(
                /^(last-used|[\w.-]+(\/[\w.-]+)+)$/,
                'defaultRepository must be last-used or owner/name'
            ),
        // 'default' (the default branch of the repository), or a branch name
        defaultBaseBranch: z
            .string()
            .trim()
            .min(1, 'defaultBaseBranch cannot be empty')
            .max(100, 'defaultBaseBranch must be at most 100 characters')
            .regex(/^[\w./-]+$/, 'defaultBaseBranch has characters git does not allow'),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'send at least one default',
    })
    .refine(
        (value) =>
            (value.defaultOwnKeyProvider === undefined && value.defaultOwnKeyModel === undefined) ||
            (typeof value.defaultOwnKeyProvider === 'string' &&
                typeof value.defaultOwnKeyModel === 'string') ||
            (value.defaultOwnKeyProvider === null && value.defaultOwnKeyModel === null),
        { message: 'send defaultOwnKeyProvider and defaultOwnKeyModel together' }
    )

// /permissions for cloud sessions (#632): tool calls the agent may never make
export const updateToolDenyRulesSchema = z.object({
    rules: z
        .array(z.string().trim().min(1, 'a rule cannot be empty').max(300))
        .max(100, 'at most 100 rules'),
})

// every field is optional: the page saves one row at a time
export const updatePullRequestSettingsSchema = z
    .object({
        branchPrefix: z
            .string()
            .trim()
            .max(40, 'branchPrefix must be at most 40 characters')
            .regex(/^[A-Za-z0-9._/-]*$/, 'branchPrefix has characters git does not allow')
            // git's ref rules on the branch the prefix gives (review E2)
            .refine((value) => checkBranchPrefix(value).ok, {
                message: 'branchPrefix does not give a branch name git allows',
            }),
        prDraft: z.boolean(),
        prCreate: z.enum(['auto', 'ask']),
        prAuthor: z.enum(['december', 'user']),
        commitAuthor: z.enum(['both', 'december']),
        archiveOnMerge: z.boolean(),
        githubCommentsEnabled: z.boolean(),
        reviewReplies: z.enum(['all', 'mention', 'off']),
        replyToBots: z.boolean(),
        fixFailedChecks: z.boolean(),
        autoReview: z.enum(['asked', 'mine', 'all']),
        reviewCadence: z.enum(['once', 'push']),
        reviewRepos: z
            .array(
                z
                    .string()
                    .trim()
                    .regex(/^[\w.-]+\/[\w.-]+$/, 'reviewRepos must be owner/name')
            )
            .max(100),
    })
    .partial()
    .strict()

export const unsubscribeQuerySchema = z.object({
    u: z.string().trim().min(1).max(100),
    t: z.string().trim().min(1).max(200),
})

// web preferences on the account (#636). the page saves one value at a time
export const preferencesSchema = z
    .object({
        sendKey: z.enum(['enter', 'mod-enter'], { message: 'sendKey must be enter or mod-enter' }),
        soundOnFinish: z.boolean({ message: 'soundOnFinish must be a boolean' }),
        messageWhileWorking: z.enum(['queue', 'send'], {
            message: 'messageWhileWorking must be queue or send',
        }),
    })
    .partial()
    .strict()

export const updatePreferencesSchema = preferencesSchema.refine(
    (value) => Object.keys(value).length > 0,
    { message: 'send at least one preference' }
)

export const updateSupportAccessSchema = z.object({
    enabled: z.boolean({ message: 'enabled must be a boolean' }),
})

export const dataExportDownloadSchema = z.object({
    id: z.string().uuid('export id is not valid'),
    t: z.string().trim().min(1).max(200),
})

// sandbox settings (#637). every field is optional: the page saves one row at a time
export const updateSandboxSettingsSchema = z
    .object({
        idleStopMinutes: z.union([z.literal(10), z.literal(30), z.literal(60)], {
            message: 'idleStopMinutes must be 10, 30 or 60',
        }),
        // null: never archive
        archiveAfterDays: z
            .union([z.literal(7), z.literal(30)], {
                message: 'archiveAfterDays must be 7, 30 or null',
            })
            .nullable(),
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'send at least one sandbox setting',
    })

export const SETUP_COMMANDS_MAX_LENGTH = 4000

// the setup commands of one repository (#637). an empty text removes them
export const updateSetupCommandsSchema = z.object({
    // owner/name, or a gitlab group path
    repoFullName: z
        .string({ message: 'repoFullName is required' })
        .trim()
        .max(200, 'repoFullName must be at most 200 characters')
        .refine(isRepoFullName, 'repoFullName must be owner/name'),
    commands: z
        .string({ message: 'commands must be a text' })
        .max(
            SETUP_COMMANDS_MAX_LENGTH,
            `commands must be at most ${SETUP_COMMANDS_MAX_LENGTH} characters`
        ),
})
