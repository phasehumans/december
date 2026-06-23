import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { importIdParamSchema, uploadRepoSchema } from './import.schema'
import { uploadService } from './import.service'

import type { Request, Response } from 'express'

const importFromGithub = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = uploadRepoSchema.parse(req.body)
    const result = await uploadService.importFromGithub({
        repoURL: parsedBody.repoURL,
        userId,
    })

    return sendSuccess(res, 'import queued', result, 202)
})

const getImportStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedParams = importIdParamSchema.parse(req.params)
    const result = await uploadService.getImportStatus({
        userId,
        importId: parsedParams.id,
    })

    return sendSuccess(res, 'import status fetched', result)
})

export const uploadController = {
    importFromGithub,
    getImportStatus,
}
