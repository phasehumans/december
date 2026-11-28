import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { hookIdParamsSchema, hookSchema, replaceHooksSchema, updateHookSchema } from './hook.schema'
import { hookService } from './hook.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listHooks = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'hooks fetched', await hookService.listHooks({ userId }))
})

const createHook = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { event, matcher, command, timeout, enabled } = hookSchema.parse(req.body)
    const result = await hookService.createHook({
        userId,
        event,
        matcher,
        command,
        timeout,
        enabled,
    })
    return sendSuccess(res, 'hook saved', result, 201)
})

const updateHook = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = hookIdParamsSchema.parse(req.params)
    const patch = updateHookSchema.parse(req.body)
    return sendSuccess(res, 'hook saved', await hookService.updateHook({ userId, id, ...patch }))
})

const deleteHook = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = hookIdParamsSchema.parse(req.params)
    return sendSuccess(res, 'hook deleted', await hookService.deleteHook({ userId, id }))
})

const replaceHooks = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { hooks } = replaceHooksSchema.parse(req.body)
    return sendSuccess(res, 'hooks saved', await hookService.replaceHooks({ userId, hooks }))
})

export const hookController = {
    listHooks,
    createHook,
    updateHook,
    deleteHook,
    replaceHooks,
}
