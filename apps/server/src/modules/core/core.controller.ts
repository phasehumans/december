import { enqueueJob } from '@december/shared'
import type { Request, Response } from 'express'

import { asyncHandler } from '../../shared/asyncHandler'

export const handlePrompt = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, projectId, sessionId } = req.body
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(401).json({ success: false, message: 'unauthorized' })
    }

    // Push job to Redis
    await enqueueJob('prompt_job', {
        prompt,
        projectId,
        sessionId,
        userId,
    })

    res.json({ success: true, message: 'Job enqueued' })
})
