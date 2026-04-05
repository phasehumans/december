import { z } from 'zod'

import { canvasDocumentSchema } from '../canvas/canvas.persistence'

const fileGeneratorSchema = z.enum([
    'static',
    'app-shell',
    'page',
    'component',
    'layout',
    'route',
    'config',
    'lib',
])

export const plannedProjectFileSchema = z
    .object({
        path: z.string().min(1),
        purpose: z.string().min(1),
        generate: z.boolean(),
        generator: fileGeneratorSchema,
    })
    .strict()

export const generateWebsiteSchema = z.object({
    prompt: z.string().min(5),
    projectId: z.string().uuid().optional(),
    canvasState: canvasDocumentSchema.optional(),
})

export const previewSelectedElementSchema = z
    .object({
        tagName: z.string().min(1),
        textContent: z.string().max(500).default(''),
    })
    .strict()

export const applyProjectEditSchema = z.object({
    projectId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
    prompt: z.string().min(1),
    selectedElement: previewSelectedElementSchema.optional(),
    canvasState: canvasDocumentSchema.optional(),
})

export const applyProjectFixSchema = z.object({
    projectId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
    errorMessage: z.string().min(1),
    stack: z.string().optional(),
})

export const projectIntentSchema = z.object({
    prompt: z.string(),
    summary: z.string(),

    appType: z.enum([
        'landing-page',
        'dashboard',
        'portfolio',
        'saas-app',
        'blog',
        'ecommerce',
        'marketplace',
        'booking-platform',
        'crm',
        'social-app',
        'admin-panel',
    ]),

    experienceType: z.enum(['marketing', 'app', 'hybrid']),

    frontendFramework: z.literal('vite-react'),
    language: z.literal('typescript'),
    styling: z.literal('tailwindcss'),
    visualStyle: z.string(),

    pages: z.array(z.string()),
    sections: z.array(z.string()),
    coreEntities: z.array(z.string()),
    coreFeatures: z.array(z.string()),
})

export const extractProjectPlanSchema = projectIntentSchema

const plannedFrontendPageSchema = z
    .object({
        name: z.string(),
        route: z.string(),
        purpose: z.string(),
    })
    .strict()

const plannedFrontendComponentSchema = z
    .object({
        name: z.string(),
        type: z.enum(['layout', 'section', 'shared', 'feature']),
        purpose: z.string(),
    })
    .strict()

const plannedFrontendSchema = z
    .object({
        pages: z.array(plannedFrontendPageSchema),
        components: z.array(plannedFrontendComponentSchema),
    })
    .strict()

export const projectPlanDataSchema = z
    .object({
        projectName: z.string(),

        layoutType: z.enum(['single-page', 'multi-page']),
        needsRouting: z.boolean(),

        installCommand: z.string(),
        dependencies: z.array(z.string()),
        devDependencies: z.array(z.string()),

        frontend: plannedFrontendSchema,

        files: z.array(plannedProjectFileSchema),
        generationOrder: z.array(z.string()),
        constraints: z.array(z.string()),
    })
    .strict()
    .superRefine((data, ctx) => {
        const filePaths = data.files.map((file) => file.path)
        const uniqueFilePaths = new Set(filePaths)

        if (uniqueFilePaths.size !== filePaths.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['files'],
                message: 'file paths must be unique',
            })
        }

        const generatedPaths = data.files.filter((file) => file.generate).map((file) => file.path)
        const generatedPathSet = new Set(generatedPaths)
        const generationOrderSet = new Set(data.generationOrder)

        if (generationOrderSet.size !== data.generationOrder.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['generationOrder'],
                message: 'generation order must not contain duplicate file paths',
            })
        }

        for (const path of data.generationOrder) {
            if (!generatedPathSet.has(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['generationOrder'],
                    message: `generation order contains unknown or non-generated path: ${path}`,
                })
            }
        }

        for (const path of generatedPathSet) {
            if (!generationOrderSet.has(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['generationOrder'],
                    message: `generation order is missing generated path: ${path}`,
                })
            }
        }
    })

export const projectPlanSchema = z
    .object({
        success: z.boolean(),
        message: z.string(),
        data: projectPlanDataSchema.nullable(),
        errors: z.array(z.string()),
    })
    .strict()
    .superRefine((plan, ctx) => {
        if (plan.success && !plan.data) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'plan data is required when success is true',
            })
        }

        if (!plan.success && plan.data !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'plan data must be null when success is false',
            })
        }
    })

export const generateProjectFileSchema = projectPlanSchema

export const promptAgentResponseSchema = z
    .object({
        summary: z.string().min(1),
        intent: projectIntentSchema,
    })
    .strict()

export const planAgentResponseSchema = z
    .object({
        message: z.string().min(1),
        plan: projectPlanSchema,
    })
    .strict()

export const projectChangedFileSchema = z.object({
    path: z.string().min(1),
    content: z.string(),
})

const projectChangeAgentResponseSchema = z
    .object({
        message: z.string().min(1),
        summary: z.string().min(1),
        updatedFiles: z.array(projectChangedFileSchema),
        deletedFiles: z.array(z.string().min(1)).default([]),
    })
    .superRefine((data, ctx) => {
        const updatedPaths = data.updatedFiles.map((file) => file.path)
        const deletedPaths = data.deletedFiles
        const duplicateUpdatedPaths = updatedPaths.filter(
            (path, index) => updatedPaths.indexOf(path) !== index
        )
        const duplicateDeletedPaths = deletedPaths.filter(
            (path, index) => deletedPaths.indexOf(path) !== index
        )

        if (duplicateUpdatedPaths.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['updatedFiles'],
                message: `duplicate updated file path: ${duplicateUpdatedPaths[0]}`,
            })
        }

        if (duplicateDeletedPaths.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['deletedFiles'],
                message: `duplicate deleted file path: ${duplicateDeletedPaths[0]}`,
            })
        }

        for (const path of deletedPaths) {
            if (updatedPaths.includes(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['deletedFiles'],
                    message: `file cannot be updated and deleted in the same response: ${path}`,
                })
            }
        }
    })

export const editAgentResponseSchema = projectChangeAgentResponseSchema
export const fixAgentResponseSchema = projectChangeAgentResponseSchema
