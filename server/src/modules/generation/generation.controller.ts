import type { Request, Response } from 'express'
import { generateWebsiteSchema } from './generation.schema'
import { generateService } from './generation.service'

const generateWebsite = async (req: Request, res: Response) => {
    const parseData = generateWebsiteSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { prompt } = parseData.data
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await generateService.generateWebsite({ prompt, userId })
        return res.status(200).json({
            success: true,
            message: 'done',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

export const generateContoller = {
    generateWebsite,
}
