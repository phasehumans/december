import type { Request, Response } from 'express'
import { AppError } from '../../shared/appError'
import { cliService } from './cli.service'

export const chatCompletions = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            throw new AppError('Unauthorized', 401)
        }

        const body = req.body

        // Verify balance before forwarding
        const hasBalance = await cliService.verifyWalletBalance(userId)
        if (!hasBalance) {
            res.status(402).json({ error: 'Insufficient credits in December Wallet.' })
            return
        }

        // Delegate to service to proxy the stream
        await cliService.proxyChatCompletions(userId, body, res)
    } catch (error: any) {
        console.error('[CLI Proxy Error]:', error)
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal Server Error',
            })
        }
    }
}

export const getHandoffUploadUrl = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            throw new AppError('Unauthorized', 401)
        }

        const data = await cliService.generateHandoffUrl(userId)
        res.json(data)
    } catch (error: any) {
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal Server Error',
            })
        }
    }
}

export const completeHandoff = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            throw new AppError('Unauthorized', 401)
        }

        const { title, messages, objectKey } = req.body
        const session = await cliService.completeHandoff(userId, title, messages, objectKey)
        res.status(201).json(session)
    } catch (error: any) {
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                error: error.message || 'Internal Server Error',
            })
        }
    }
}

export const cliController = {
    chatCompletions,
    getHandoffUploadUrl,
    completeHandoff,
}
