import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    installPluginSchema,
    pluginNameParamsSchema,
    setPluginEnabledSchema,
} from './plugin.schema'
import { pluginService } from './plugin.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listPlugins = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'plugins fetched', await pluginService.listPlugins({ userId }))
})

const listMarketplace = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'marketplace fetched', await pluginService.listMarketplace({ userId }))
})

const installPlugin = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { source } = installPluginSchema.parse(req.body)
    return sendSuccess(
        res,
        'plugin installed',
        await pluginService.installPlugin({ userId, source }),
        201
    )
})

const setPluginEnabled = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = pluginNameParamsSchema.parse(req.params)
    const { enabled } = setPluginEnabledSchema.parse(req.body)
    return sendSuccess(
        res,
        'plugin updated',
        await pluginService.setPluginEnabled({ userId, name, enabled })
    )
})

const updatePlugin = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = pluginNameParamsSchema.parse(req.params)
    return sendSuccess(res, 'plugin updated', await pluginService.updatePlugin({ userId, name }))
})

const uninstallPlugin = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = pluginNameParamsSchema.parse(req.params)
    return sendSuccess(
        res,
        'plugin uninstalled',
        await pluginService.uninstallPlugin({ userId, name })
    )
})

export const pluginController = {
    listPlugins,
    listMarketplace,
    installPlugin,
    setPluginEnabled,
    updatePlugin,
    uninstallPlugin,
}
