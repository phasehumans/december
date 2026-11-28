import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    CreateSecretSchema,
    BulkCreateSecretsSchema,
    SecretNameParamsSchema,
    SecretRepoQuerySchema,
} from './secrets.schema'
import { secretsService } from './secrets.service'

import type { Request, Response } from 'express'

const getSecrets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    // names, notes and repositories only: a value is never in the list
    const secrets = await secretsService.getSecrets({ userId })
    return sendSuccess(res, 'secrets fetched successfully', { secrets })
})

const getSecretValue = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { name } = SecretNameParamsSchema.parse(req.params)
    // ?repo=owner/name reads the row of that repository; none reads "all repositories"
    const { repo } = SecretRepoQuerySchema.parse(req.query)
    const secret = await secretsService.getSecretValue({
        userId,
        name,
        repoFullName: repo,
        ip: req.ip || req.socket.remoteAddress || null,
    })
    // a plain value: no browser or proxy may keep a copy
    res.set('Cache-Control', 'no-store')
    return sendSuccess(res, 'secret value fetched successfully', { secret })
})

const createSecret = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = CreateSecretSchema.parse(req.body)
    const secret = await secretsService.createSecret({
        userId,
        name: data.name,
        value: data.value,
        note: data.note,
        repoFullName: data.repoFullName,
    })
    return sendSuccess(res, 'secret created successfully', { secret }, 201)
})

const bulkCreateSecrets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = BulkCreateSecretsSchema.parse(req.body)
    const result = await secretsService.bulkCreateSecrets({
        userId,
        secrets: data.secrets,
        repoFullName: data.repoFullName,
    })
    return sendSuccess(res, 'secrets created successfully', result, 201)
})

const deleteSecret = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { name } = SecretNameParamsSchema.parse(req.params)
    const { repo } = SecretRepoQuerySchema.parse(req.query)
    await secretsService.deleteSecret({ userId, name, repoFullName: repo })
    return sendSuccess(res, 'secret deleted successfully', null)
})

export const secretsController = {
    getSecrets,
    getSecretValue,
    createSecret,
    bulkCreateSecrets,
    deleteSecret,
}
