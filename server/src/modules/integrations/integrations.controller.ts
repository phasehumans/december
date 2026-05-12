import type { Request, Response } from 'express'
import { integrationsService } from './integrations.service'

const getUserGithubRepos = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await integrationsService.listGithubRepos(userId)
        return res.status(200).json({
            success: true,
            message: 'repos fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'failed to fetch repos',
            error: error.message,
        })
    }
}

export const integrationsController = {
    getUserGithubRepos,
}
