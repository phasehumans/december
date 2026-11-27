import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    adjustCreditsSchema,
    creditLedgerQuerySchema,
    idParamSchema,
    listUsersQuerySchema,
    rejectCreditRequestSchema,
    sandboxActionParamsSchema,
} from './admin.schema'
import { adminService } from './admin.service'

import type { Request, Response } from 'express'

const adminId = (req: Request) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const getMe = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.user?.sessionId
    if (!sessionId) throw new AppError('unauthorized', 401)
    const result = await adminService.getMe({ adminUserId: adminId(req), sessionId })
    return sendSuccess(res, 'admin fetched', result)
})

const approveCreditRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const result = await adminService.approveCreditRequest({
        adminUserId: adminId(req),
        requestId: id,
    })
    return sendSuccess(res, 'credit request approved', result)
})

const rejectCreditRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const { reason } = rejectCreditRequestSchema.parse(req.body)
    const result = await adminService.rejectCreditRequest({
        adminUserId: adminId(req),
        requestId: id,
        reason,
    })
    return sendSuccess(res, 'credit request rejected', result)
})

const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const query = listUsersQuerySchema.parse(req.query)
    const result = await adminService.listUsers(query)
    return sendSuccess(res, 'users fetched', result)
})

const getUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const result = await adminService.getUser({ userId: id })
    return sendSuccess(res, 'user fetched', result)
})

const adjustCredits = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const body = adjustCreditsSchema.parse(req.body)
    const result = await adminService.adjustCredits({
        adminUserId: adminId(req),
        userId: id,
        ...body,
    })
    return sendSuccess(res, 'credits changed', result)
})

const listSandboxes = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminService.listSandboxes()
    return sendSuccess(res, 'sandboxes fetched', result)
})

const controlSandbox = asyncHandler(async (req: Request, res: Response) => {
    const { id, action } = sandboxActionParamsSchema.parse(req.params)
    const result = await adminService.controlSandbox({
        adminUserId: adminId(req),
        sessionId: id,
        action,
    })
    return sendSuccess(res, `sandbox ${action} requested`, result)
})

const listProductEmailUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.listProductEmailUsers({ adminUserId: adminId(req) })
    return sendSuccess(res, 'product email list fetched', result)
})

const listCreditLedger = asyncHandler(async (req: Request, res: Response) => {
    const query = creditLedgerQuerySchema.parse(req.query)
    const result = await adminService.listCreditLedger({ adminUserId: adminId(req), ...query })
    return sendSuccess(res, 'credit history fetched', result)
})

export const adminController = {
    listProductEmailUsers,
    getMe,
    approveCreditRequest,
    rejectCreditRequest,
    listUsers,
    getUser,
    adjustCredits,
    listCreditLedger,
    listSandboxes,
    controlSandbox,
}
