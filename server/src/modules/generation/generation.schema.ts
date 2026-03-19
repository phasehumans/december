import { z } from 'zod'

export const generateWebsiteSchema = z.object({
    prompt: z.string().min(5),
    isDB: z.boolean(),
    dbURL: z.string().optional(),
})

export const extractProjectPlanSchema = z.object({
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

export const generateProjectFileSchema = z.object({
    success: z.boolean(),
    message: z.string(),

    data: z.object({
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

        files: z.array(
            z.object({
                path: z.string(),
                purpose: z.string(),
                generate: z.boolean(),
                generator: z.enum([
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
                ]),
            })
        ),

        generationOrder: z.array(z.string()),
        constraints: z.array(z.string()),
    }),

    errors: z.array(z.string()),
})
