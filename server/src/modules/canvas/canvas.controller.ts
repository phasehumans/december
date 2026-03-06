import type { Request, Response } from 'express'
import { getWebClipsSchema } from './canvas.schema'
import { canvasService } from './canvas.service'

const getWebClips = async (req: Request, res: Response) => {
    const parseData = getWebClipsSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { url } = parseData.data

    try {
        const result = await canvasService.getWebClips({ url })
        return res.status(200).json({
            success: true,
            message: 'webclips fetched successfully',
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
    getWebClips,
}
