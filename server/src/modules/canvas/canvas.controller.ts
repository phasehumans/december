import type { Request, Response } from 'express'

import { webClipRequestSchema } from './canvas.schema'
import { canvasService } from './canvas.service'

const createWebClips = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = webClipRequestSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { url, projectId } = parseData.data

    try {
        const result = await canvasService.createWebClips({ url, userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'web clips created successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

export const canvasController = {
    createWebClips,
}
