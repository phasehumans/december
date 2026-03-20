import type { Request, Response } from 'express'
import { generateWebsiteSchema } from './generation.schema'
import { generateService } from './generation.service'

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

    const { prompt, isDB, dbURL } = parseData.data
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
        res.setHeader('X-Accel-Buffering', 'no')
        res.flushHeaders?.()

        writeEvent(res, 'connected', { ok: true })

        await generateService.generateWebsite({
            prompt,
            userId,
            isDB,
            dbURL,
            onEvent: async (event) => {
                writeEvent(res, event.type, event.data)
            },
        })

        return res.end()
    } catch (error: any) {
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                errors: error.message,
            })
        }

        writeEvent(res, 'error', {
            message: error.message,
        })

        return res.end()
    }
}

export const generateContoller = {
    generateWebsite,
}
