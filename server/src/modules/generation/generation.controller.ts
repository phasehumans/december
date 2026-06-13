import { AppError } from '../../shared/appError'
import { normalizeGenerationError } from './generation.error'
import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    generateWebsiteSchema,
} from './generation.schema'
import { generateService } from './generation.service'
import { usageService } from '../usage/usage.service'
import { runtimeService } from '../runtime/runtime.service'
import { prisma } from '../../config/db'

import type { Request, Response } from 'express'

const writeEvent = (res: Response, event: string, data: unknown) => {
    if (res.writableEnded) {
        return
    }

    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const generateWebsite = async (req: Request, res: Response) => {
    const parseData = generateWebsiteSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { prompt, projectId, canvasState } = parseData.data
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const hasCredits = await usageService.hasMinimumBalance({ userId })
    if (!hasCredits) {
        return res.status(402).json({
            success: false,
            message: 'insufficient_credits',
            errors: 'You have run out of credits. Please purchase more credits or upgrade to Pro to continue.',
        })
    }

    try {
        res.status(200)
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no') //explicit for nginx
        res.flushHeaders?.()

        writeEvent(res, 'connected', { ok: true })

        await generateService.generateWebsite({
            prompt,
            userId,
            projectId,
            canvasState,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error) {
        const normalizedError = normalizeGenerationError(error)
        console.error('[generation]', normalizedError.internalMessage)

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: normalizedError.publicMessage,
            })
        }

        writeEvent(res, 'error', {
            message: normalizedError.publicMessage,
        })

        return res.end()
    }
}

const prepareStream = (res: Response) => {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    writeEvent(res, 'connected', { ok: true })
}

const applyProjectEdit = async (req: Request, res: Response) => {
    const parseData = applyProjectEditSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const hasCredits = await usageService.hasMinimumBalance({ userId })
    if (!hasCredits) {
        return res.status(402).json({
            success: false,
            message: 'insufficient_credits',
            errors: 'You have run out of credits. Please purchase more credits or upgrade to Pro to continue.',
        })
    }

    try {
        prepareStream(res)

        await generateService.applyProjectEdit({
            ...parseData.data,
            userId,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error) {
        const normalizedError = normalizeGenerationError(error)
        console.error('[generation/edit]', normalizedError.internalMessage)

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: normalizedError.publicMessage,
            })
        }

        writeEvent(res, 'error', {
            message: normalizedError.publicMessage,
        })

        return res.end()
    }
}

const applyProjectFix = async (req: Request, res: Response) => {
    const parseData = applyProjectFixSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const hasCredits = await usageService.hasMinimumBalance({ userId })
    if (!hasCredits) {
        return res.status(402).json({
            success: false,
            message: 'insufficient_credits',
            errors: 'You have run out of credits. Please purchase more credits or upgrade to Pro to continue.',
        })
    }

    try {
        prepareStream(res)

        await generateService.applyProjectFix({
            ...parseData.data,
            userId,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error) {
        const normalizedError = normalizeGenerationError(error)
        console.error('[generation/fix]', normalizedError.internalMessage)

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: normalizedError.publicMessage,
            })
        }

        writeEvent(res, 'error', {
            message: normalizedError.publicMessage,
        })

        return res.end()
    }
}

const validateProject = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const project = await prisma.project.findFirst({
            where: {
                id,
                userId,
            },
        })

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'project not found',
            })
        }

        const result = await runtimeService.checkSandboxCompilation({ projectId: id })
        return res.status(200).json({
            success: true,
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to validate project',
                errors: error.message,
            })
        }

        const normalizedError = normalizeGenerationError(error)
        console.error('[generation/validate]', normalizedError.internalMessage)
        return res.status(500).json({
            success: false,
            message: normalizedError.publicMessage,
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const generateContoller = {
    applyProjectEdit,
    applyProjectFix,
    generateWebsite,
    validateProject,
}
