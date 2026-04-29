import { z } from 'zod'

export const startPreviewSchema = z.object({
    projectId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
})

export const previewIdParamSchema = z.object({
    id: z.string().uuid(),
})

export const runtimeStatusCallbackSchema = z.object({
    previewId: z.string().uuid(),
    projectId: z.string().uuid(),
    status: z.enum(['ready', 'rebuilding', 'failed']),
    state: z.enum([
        'WaitingForRunnableVersion',
        'Bootstrapping',
        'Installing',
        'Starting',
        'Healthy',
        'Rebuilding',
        'Failed',
        'Stopped',
    ]),
    currentVersion: z.string().uuid().nullable().optional(),
    healthyVersion: z.string().uuid().nullable().optional(),
    previewUrl: z.string().url().nullable().optional(),
    error: z
        .object({
            class: z.enum([
                'temporary_partial_generation',
                'stable_compile_runtime',
                'dependency_install',
                'infra_runtime',
            ]),
            code: z.string(),
            message: z.string(),
            detail: z.string().nullable().optional(),
            retryable: z.boolean(),
        })
        .nullable()
        .optional(),
    updatedAt: z.string(),
})
