import type { Request, Response } from 'express'
import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    generateWebsiteSchema,
} from './generation.schema'
import { generateService } from './generation.service'
import { normalizeGenerationError } from './generation.error'

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
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
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
    } catch (error: unknown) {
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

const applyProjectEdit = async (req: Request, res: Response) => {
    const parseData = applyProjectEditSchema.safeParse(req.body)
    const userId = req.userId as string | undefined

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await generateService.applyProjectEdit({
            ...parseData.data,
            userId,
        })

        return res.status(200).json({
            success: true,
            message: 'project updated',
            data: result,
        })
    } catch (error) {
        const normalizedError = normalizeGenerationError(error)
        console.error('[generation/edit]', normalizedError.internalMessage)

        return res.status(500).json({
            success: false,
            message: normalizedError.publicMessage,
            errors: normalizedError.internalMessage,
        })
    }
}

const applyProjectFix = async (req: Request, res: Response) => {
    const parseData = applyProjectFixSchema.safeParse(req.body)
    const userId = req.userId as string | undefined

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await generateService.applyProjectFix({
            ...parseData.data,
            userId,
        })

        return res.status(200).json({
            success: true,
            message: 'project fixed',
            data: result,
        })
    } catch (error) {
        const normalizedError = normalizeGenerationError(error)
        console.error('[generation/fix]', normalizedError.internalMessage)

        return res.status(500).json({
            success: false,
            message: normalizedError.publicMessage,
            errors: normalizedError.internalMessage,
        })
    }
}

export const generateContoller = {
    generateWebsite,
    applyProjectEdit,
    applyProjectFix,
}


