import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { providerParamSchema, refreshCredentialSchema, saveCredentialSchema } from './byok.schema'
import { byokService } from './byok.service'

import type { Request, Response } from 'express'

const requireUserId = (req: Request) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listCredentials = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req)
    const result = await byokService.listCredentials({ userId })
    return sendSuccess(res, 'provider keys fetched successfully', result)
})

const saveCredential = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req)
    const { provider } = providerParamSchema.parse(req.params)
    const { apiKey } = saveCredentialSchema.parse(req.body)
    const credential = await byokService.saveCredential({ userId, provider, apiKey })
    return sendSuccess(res, 'provider key saved successfully', { credential })
})

const refreshCredential = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req)
    const { provider } = providerParamSchema.parse(req.params)
    refreshCredentialSchema.parse(req.body ?? {})
    const credential = await byokService.refreshCredential({ userId, provider })
    return sendSuccess(res, 'provider key checked successfully', { credential })
})

const deleteCredential = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req)
    const { provider } = providerParamSchema.parse(req.params)
    await byokService.deleteCredential({ userId, provider })
    return sendSuccess(res, 'provider key deleted successfully', null)
})

export const byokController = {
    listCredentials,
    saveCredential,
    refreshCredential,
    deleteCredential,
}
