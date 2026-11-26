import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { totpCodeSchema } from './admintotp.schema'
import { admintotpService } from './admintotp.service'

import type { Request, Response } from 'express'

const context = (req: Request) => {
    const user = req.user
    if (!user?.userId || !user.sessionId) throw new AppError('unauthorized', 401)
    return { userId: user.userId, sessionId: user.sessionId }
}

const startSetup = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = context(req)
    const result = await admintotpService.startSetup({ userId })
    res.set('Cache-Control', 'no-store')
    return sendSuccess(res, 'scan the code with your authenticator app', result)
})

const enable = asyncHandler(async (req: Request, res: Response) => {
    const { code } = totpCodeSchema.parse(req.body)
    const result = await admintotpService.enable({ ...context(req), code })
    return sendSuccess(res, 'authenticator turned on', result)
})

const verify = asyncHandler(async (req: Request, res: Response) => {
    const { code } = totpCodeSchema.parse(req.body)
    const result = await admintotpService.verify({ ...context(req), code })
    return sendSuccess(res, 'code accepted', result)
})

export const admintotpController = {
    startSetup,
    enable,
    verify,
}
