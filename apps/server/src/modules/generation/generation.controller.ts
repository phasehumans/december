import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'
import { runtimeService } from '../runtime/runtime.service'
import { usageService } from '../usage/usage.service'

import { normalizeGenerationError } from './generation.error'
import { findProjectByIdAndUser } from './generation.repository'
import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    generateWebsiteSchema,
} from './generation.schema'
import { generateService } from './generation.service'

import type { Request, Response } from 'express'

const writeEvent = (res: Response, event: string, data: unknown) => {
    if (res.writableEnded) {
        return
    }

    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const generateWebsite = asyncHandler(async (req: Request, res: Response) => {
    const parseData = generateWebsiteSchema.parse(req.body)
    const { prompt, projectId, canvasState } = parseData
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
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
        const normalizedError = normalizeGenerationError({ error })
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
})

const prepareStream = (res: Response) => {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    writeEvent(res, 'connected', { ok: true })
}

const applyProjectEdit = asyncHandler(async (req: Request, res: Response) => {
    const parseData = applyProjectEditSchema.parse(req.body)
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
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
            ...parseData,
            userId,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error) {
        const normalizedError = normalizeGenerationError({ error })
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
})

const applyProjectFix = asyncHandler(async (req: Request, res: Response) => {
    const parseData = applyProjectFixSchema.parse(req.body)
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
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
            ...parseData,
            userId,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error) {
        const normalizedError = normalizeGenerationError({ error })
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
})

const validateProject = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const project = await findProjectByIdAndUser({ id, userId })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    const result = await runtimeService.checkSandboxCompilation({ projectId: id })
    return sendSuccess(res, 'project validated successfully', result)
})

export const generateContoller = {
    applyProjectEdit,
    applyProjectFix,
    generateWebsite,
    validateProject,
}
