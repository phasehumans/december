import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { memoryContentSchema, memoryIdParamsSchema, memorySettingsSchema } from './memory.schema'
import { memoryService } from './memory.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listMemories = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'memories fetched', await memoryService.listMemories({ userId }))
})

const setMemoryEnabled = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { enabled } = memorySettingsSchema.parse(req.body)
    return sendSuccess(
        res,
        'memory setting saved',
        await memoryService.setMemoryEnabled({ userId, enabled })
    )
})

const addMemory = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { content } = memoryContentSchema.parse(req.body)
    return sendSuccess(res, 'memory saved', await memoryService.addMemory({ userId, content }), 201)
})

const updateMemory = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = memoryIdParamsSchema.parse(req.params)
    const { content } = memoryContentSchema.parse(req.body)
    return sendSuccess(
        res,
        'memory saved',
        await memoryService.updateMemory({ userId, id, content })
    )
})

const deleteMemory = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = memoryIdParamsSchema.parse(req.params)
    return sendSuccess(res, 'memory deleted', await memoryService.deleteMemory({ userId, id }))
})

const deleteAllMemories = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'memories deleted', await memoryService.deleteAllMemories({ userId }))
})

export const memoryController = {
    listMemories,
    setMemoryEnabled,
    addMemory,
    updateMemory,
    deleteMemory,
    deleteAllMemories,
}
