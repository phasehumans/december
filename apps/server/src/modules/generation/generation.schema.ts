import { z } from 'zod'

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

const REQUIRED_GENERATED_PROJECT_PATHS = [
    'package.json',
    'index.html',
    'src/frontend.tsx',
    'src/index.css',
    'src/App.tsx',
] as const
const REQUIRED_RUNTIME_DEPENDENCIES = ['react', 'react-dom', 'bun-plugin-tailwind', 'tailwindcss']
const REQUIRED_RUNTIME_DEV_DEPENDENCIES = ['@types/react', '@types/react-dom', '@types/bun']

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
    canvasState: z.any().optional(),
    model: z.string().optional(),
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
    canvasState: z.any().optional(),
    model: z.string().optional(),
})

export const applyProjectFixSchema = z.object({
    projectId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
    errorMessage: z.string().min(1),
    stack: z.string().optional(),
    model: z.string().optional(),
})

export const projectIntentSchema = z.object({
    prompt: z.string(),
    summary: z.string(),
    projectName: z.string(),
    appType: z.enum(['landing-page', 'dashboard', 'portfolio & blog', 'saas-app', 'ecommerce']),
    audience: z.string(),
    primaryGoal: z.string(),
    visualDirection: z.string(),
    keyScreens: z.array(z.string()),
    keyCapabilities: z.array(z.string()),
    canvasSignals: z.array(z.string()),
})

export const extractProjectPlanSchema = z
    .object({
        userPrompt: z.string().min(1),
        canvasState: z.any().optional(),
    })
    .strict()

const plannedRouteSchema = z
    .object({
        name: z.string(),
        path: z.string(),
        purpose: z.string(),
    })
    .strict()

const plannedArchitectureSchema = z
    .object({
        appShape: z.string(),
        routing: z.string(),
        state: z.string(),
        styling: z.string(),
    })
    .strict()

export const projectPlanDataSchema = z
    .object({
        projectName: z.string(),
        goal: z.string(),
        routes: z.array(plannedRouteSchema),
        architecture: plannedArchitectureSchema,
        dependencies: z.array(z.string()),
        devDependencies: z.array(z.string()),
        files: z.array(plannedProjectFileSchema),
        buildOrder: z.array(z.string()),
        builderNotes: z.array(z.string()),
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
        const buildOrderSet = new Set(data.buildOrder)

        if (buildOrderSet.size !== data.buildOrder.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['buildOrder'],
                message: 'build order must not contain duplicate file paths',
            })
        }

        for (const path of data.buildOrder) {
            if (!generatedPathSet.has(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['buildOrder'],
                    message: `build order contains unknown or non-generated path: ${path}`,
                })
            }
        }

        for (const path of generatedPathSet) {
            if (!buildOrderSet.has(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['buildOrder'],
                    message: `build order is missing generated path: ${path}`,
                })
            }
        }

        for (const path of REQUIRED_GENERATED_PROJECT_PATHS) {
            if (!generatedPathSet.has(path)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['files'],
                    message: `required generated path is missing: ${path}`,
                })
            }
        }

        for (const dependency of REQUIRED_RUNTIME_DEPENDENCIES) {
            if (!data.dependencies.includes(dependency)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['dependencies'],
                    message: `required dependency is missing: ${dependency}`,
                })
            }
        }

        for (const dependency of REQUIRED_RUNTIME_DEV_DEPENDENCIES) {
            if (!data.devDependencies.includes(dependency)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['devDependencies'],
                    message: `required dev dependency is missing: ${dependency}`,
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

export const planAgentResponseSchema = z
    .object({
        thoughts: z.array(z.string().min(1)).min(1),
        plan_of_action: z.array(z.string().min(1)).min(1),
        intent: projectIntentSchema,
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

export const projectPatchOperationSchema = z
    .object({
        path: z.string().min(1),
        action: z.enum(['create', 'update', 'delete']),
        purpose: z.string().min(1),
        instructions: z.string().min(1),
    })
    .strict()

export const projectChangePlanDataSchema = z
    .object({
        summary: z.string().min(1),
        operations: z.array(projectPatchOperationSchema).min(1),
    })
    .strict()
    .superRefine((data, ctx) => {
        const paths = data.operations.map((operation) => operation.path)
        const duplicatePath = paths.find((path, index) => paths.indexOf(path) !== index)

        if (duplicatePath) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['operations'],
                message: `duplicate patch operation path: ${duplicatePath}`,
            })
        }
    })

export const projectChangePlanSchema = z
    .object({
        success: z.boolean(),
        message: z.string(),
        data: projectChangePlanDataSchema.nullable(),
        errors: z.array(z.string()),
    })
    .strict()
    .superRefine((plan, ctx) => {
        if (plan.success && !plan.data) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'change plan data is required when success is true',
            })
        }

        if (!plan.success && plan.data !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'change plan data must be null when success is false',
            })
        }
    })

export const projectChangePlanResponseSchema = z
    .object({
        thoughts: z.array(z.string().min(1)).min(1),
        plan_of_action: z.array(z.string().min(1)).min(1),
        plan: projectChangePlanSchema,
    })
    .strict()
