import { z } from 'zod'

export const createProjectSchema = z.object({
    name: z
        .string({ message: 'name is required' })
        .min(3, 'name must be at least 3 characters')
        .max(50, 'name must be at most 50 characters'),
    description: z
        .string({ message: 'description must be a string' })
        .min(10, 'description must be at least 10 characters')
        .max(500, 'description must be at most 500 characters')
        .optional(),
    prompt: z
        .string({ message: 'prompt is required' })
        .min(3, 'prompt must be at least 3 characters'),
})

export const renameProjectSchema = z.object({
    rename: z
        .string({ message: 'rename is required' })
        .min(3, 'rename must be at least 3 characters')
        .max(50, 'rename must be at most 50 characters'),
})

export const updateGeneralSettingsSchema = z.object({
    name: z
        .string({ message: 'project name must be a string' })
        .min(3, 'project name must be at least 3 characters')
        .max(50, 'project name must be at most 50 characters')
        .optional(),
    description: z
        .string({ message: 'project description must be a string' })
        .min(10, 'project description must be at least 10 characters')
        .max(500, 'project description must be at most 500 characters')
        .nullable()
        .optional(),
    isStarred: z.boolean({ message: 'isStarred must be a boolean' }).optional(),
    isSharedAsTemplate: z.boolean({ message: 'isSharedAsTemplate must be a boolean' }).optional(),
    projectCategory: z
        .enum(['LANDING_PAGE', 'DASHBOARD', 'PORTFOLIO_BLOG', 'SAAS_APP', 'ECOMMERCE', 'NONE'], {
            message: 'nvalid project category',
        })
        .optional(),
})

export const getProjectByIdSchema = z.object({
    versionId: z
        .string({ message: 'version ID must be a string' })
        .uuid('version ID must be a valid UUID')
        .optional(),
})

export const duplicateProjectSchema = z.object({
    name: z
        .string({ message: 'project name must be a string' })
        .min(3, 'project name must be at least 3 characters')
        .max(50, 'project name must be at most 50 characters')
        .optional(),
})

export const toggleStarProjectSchema = z.object({
    isStarred: z.boolean({ message: 'isStarred must be a boolean' }),
})

export const shareProjectAsTemplateSchema = z.object({
    isSharedAsTemplate: z.boolean({ message: 'isSharedAsTemplate must be a boolean' }),
    projectCategory: z
        .enum(['LANDING_PAGE', 'DASHBOARD', 'PORTFOLIO_BLOG', 'SAAS_APP', 'ECOMMERCE', 'NONE'])
        .optional(),
})
