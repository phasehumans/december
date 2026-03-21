import { z } from 'zod'

const fileGeneratorSchema = z.enum([
    'static',
    'app-shell',
    'page',
    'component',
    'layout',
    'route',
    'api',
    'model',
    'schema',
    'config',
    'lib',
])

export const plannedProjectFileSchema = z.object({
    path: z.string().min(1),
    purpose: z.string().min(1),
    generate: z.boolean(),
    generator: fileGeneratorSchema,
})

export const generateWebsiteSchema = z
    .object({
        prompt: z.string().min(5),
        isDB: z.boolean(),
        dbURL: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.isDB && !data.dbURL?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['dbURL'],
                message: 'db url is required when database is enabled',
            })
        }
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
    backendFramework: z.literal('express'),
    runTime: z.literal('bun'),

    databaseProvider: z.literal('neon-postgres'),
    databaseConnection: z.literal('neon-url'),

    database: z.enum(['postgres', 'none']),

    authStrategy: z.literal('jwt-email-password'),
    auth: z.enum(['required', 'optional', 'none']),

    pages: z.array(z.string()),
    sections: z.array(z.string()),
    coreEntities: z.array(z.string()),
    coreFeatures: z.array(z.string()),

    needsBackend: z.boolean(),
    needsDatabase: z.boolean(),
    needsAuthentication: z.boolean(),
    needsFileStorage: z.boolean(),
    needsPayments: z.boolean(),
})

export const extractProjectPlanSchema = projectIntentSchema

export const projectPlanDataSchema = z
    .object({
        projectName: z.string(),

        layoutType: z.enum(['single-page', 'multi-page']),
        needsRouting: z.boolean(),

        installCommands: z.object({
            web: z.array(z.string()),
            server: z.array(z.string()),
        }),

        dependencies: z.object({
            web: z.array(z.string()),
            server: z.array(z.string()),
        }),

        devDependencies: z.object({
            web: z.array(z.string()),
            server: z.array(z.string()),
        }),

        frontend: z.object({
            pages: z.array(
                z.object({
                    name: z.string(),
                    route: z.string(),
                    purpose: z.string(),
                })
            ),

            components: z.array(
                z.object({
                    name: z.string(),
                    type: z.enum(['layout', 'section', 'shared', 'feature']),
                    purpose: z.string(),
                })
            ),
        }),

        backend: z.object({
            enabled: z.boolean(),

            modules: z.array(
                z.object({
                    name: z.string(),
                    purpose: z.string(),
                })
            ),

            apiResources: z.array(
                z.object({
                    name: z.string(),
                    basePath: z.string(),
                    purpose: z.string(),
                })
            ),
        }),

        databasePlan: z.object({
            enabled: z.boolean(),

            orm: z.enum(['prisma', 'none']),
            validation: z.enum(['zod', 'none']),

            tables: z.array(
                z.object({
                    name: z.string(),
                    purpose: z.string(),
                    columns: z.array(z.string()),
                })
            ),
        }),

        files: z.array(plannedProjectFileSchema),
        generationOrder: z.array(z.string()),
        constraints: z.array(z.string()),
    })
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

export const promptAgentResponseSchema = z.object({
    message: z.string().min(1),
    intent: projectIntentSchema,
})

export const planAgentResponseSchema = z.object({
    message: z.string().min(1),
    plan: projectPlanSchema,
})
