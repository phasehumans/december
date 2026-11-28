import { checkBranchPrefix, isRepoFullName } from '@december/shared'
import { z } from 'zod'

import { isValidTimezone } from '../notification/notification.utils'

export const updateNameSchema = z.object({
    name: z
        .string({ message: 'name is required' })
        .trim()
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
        // turning push on goes through POST /notification/push/subscribe; off works here too
        notifyPush: z.literal(false, { message: 'turn push on from the browser' }),
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

// the same limit as the box in the web app
export const FEEDBACK_MAX_LENGTH = 5000

export const submitFeedbackSchema = z.object({
    rating: z.enum(['sad', 'neutral', 'happy']).nullable(),
    feedback: z
        .string({ message: 'feedback is required' })
        .trim()
        .min(1, 'feedback cannot be empty')
        .max(FEEDBACK_MAX_LENGTH, `feedback must be at most ${FEEDBACK_MAX_LENGTH} characters`),
})

export const updateModelSourceSchema = z.object({
    defaultModelSource: z.enum(['CREDITS', 'OWN_KEY'], {
        message: 'defaultModelSource must be CREDITS or OWN_KEY',
    }),
})

// "save as default" in the prompt box (#632): plan first and open pull request. both are
// optional, at least one is sent
export const updateSessionDefaultsSchema = z
    .object({
        defaultPlanFirst: z.boolean(),
        defaultOpenPullRequest: z.boolean(),
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'send at least one default',
    })

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
        prAuthor: z.enum(['december', 'user']),
        commitAuthor: z.enum(['both', 'december']),
        githubCommentsEnabled: z.boolean(),
        reviewReplies: z.enum(['all', 'mention', 'off']),
        fixFailedChecks: z.boolean(),
        autoReview: z.enum(['asked', 'mine', 'all']),
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'send at least one setting',
    })

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
