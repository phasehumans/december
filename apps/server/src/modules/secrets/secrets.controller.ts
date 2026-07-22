import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { CreateSecretSchema } from './secrets.schema'
import { secretsService } from './secrets.service'

import type { Request, Response } from 'express'

const getSecrets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const secrets = await secretsService.getSecrets(userId)
    return sendSuccess(res, 'secrets fetched successfully', { secrets })
})

const createSecret = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = CreateSecretSchema.parse(req.body)
    const secret = await secretsService.createSecret(userId, data.name, data.value)
    return sendSuccess(
        res,
        'secret created successfully',
        { secret: { id: secret.id, name: secret.name } },
        201
    )
})

const deleteSecret = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const name = req.params.name as string
    if (!name) throw new AppError('secret name is required', 400)

    await secretsService.deleteSecret(userId, name)
    return sendSuccess(res, 'secret deleted successfully', null)
})

export const secretsController = {
    getSecrets,
    createSecret,
    deleteSecret,
}
