import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    adjustCreditsSchema,
    assignInstallationSchema,
    auditLogQuerySchema,
    createRedeemCodeSchema,
    dailyUsageQuerySchema,
    idParamSchema,
    listCreditRequestsQuerySchema,
    listFeedbackQuerySchema,
    listUsersQuerySchema,
    rejectCreditRequestSchema,
    sandboxActionParamsSchema,
    sendAnnouncementSchema,
    testAnnouncementSchema,
    userSessionParamsSchema,
} from './admin.schema'
import { adminService } from './admin.service'

import type { Request, Response } from 'express'

const adminId = (req: Request) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const getMe = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.getMe({ adminUserId: adminId(req) })
    return sendSuccess(res, 'admin fetched', result)
})

const listCreditRequests = asyncHandler(async (req: Request, res: Response) => {
    const query = listCreditRequestsQuerySchema.parse(req.query)
    const result = await adminService.listCreditRequests(query)
    return sendSuccess(res, 'credit requests fetched', result)
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

const listFeedback = asyncHandler(async (req: Request, res: Response) => {
    const query = listFeedbackQuerySchema.parse(req.query)
    const result = await adminService.listFeedback(query)
    return sendSuccess(res, 'feedback fetched', result)
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

const listUserSessions = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const result = await adminService.listUserSessions({ adminUserId: adminId(req), userId: id })
    return sendSuccess(res, 'user sessions fetched', result)
})

const openUserSession = asyncHandler(async (req: Request, res: Response) => {
    const { id, sessionId } = userSessionParamsSchema.parse(req.params)
    const result = await adminService.openUserSession({
        adminUserId: adminId(req),
        userId: id,
        sessionId,
    })
    return sendSuccess(res, 'user session fetched', result)
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

const restoreUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const result = await adminService.restoreUser({ adminUserId: adminId(req), userId: id })
    return sendSuccess(res, 'account restored', result)
})

const listRedeemCodes = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminService.listRedeemCodes()
    return sendSuccess(res, 'redeem codes fetched', result)
})

const createRedeemCode = asyncHandler(async (req: Request, res: Response) => {
    const body = createRedeemCodeSchema.parse(req.body)
    const result = await adminService.createRedeemCode({ adminUserId: adminId(req), ...body })
    return sendSuccess(res, 'redeem code created', result, 201)
})

const listInstallations = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminService.listInstallations()
    return sendSuccess(res, 'installations fetched', result)
})

const assignInstallation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const { userId } = assignInstallationSchema.parse(req.body)
    const result = await adminService.assignInstallation({
        adminUserId: adminId(req),
        installationId: id,
        userId,
    })
    return sendSuccess(res, 'installation assigned', result)
})

const listAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminService.listAnnouncements()
    return sendSuccess(res, 'announcements fetched', result)
})

const sendTestAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const body = testAnnouncementSchema.parse(req.body)
    const result = await adminService.sendTestAnnouncement({ adminUserId: adminId(req), ...body })
    return sendSuccess(res, 'test sent', result)
})

const sendAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const body = sendAnnouncementSchema.parse(req.body)
    const result = await adminService.sendAnnouncement({ adminUserId: adminId(req), ...body })
    return sendSuccess(res, 'announcement sent', result, 201)
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

const dailyUsage = asyncHandler(async (req: Request, res: Response) => {
    const query = dailyUsageQuerySchema.parse(req.query)
    const result = await adminService.dailyUsage(query)
    return sendSuccess(res, 'usage fetched', result)
})

const listAuditLog = asyncHandler(async (req: Request, res: Response) => {
    const query = auditLogQuerySchema.parse(req.query)
    const result = await adminService.listAuditLog(query)
    return sendSuccess(res, 'audit log fetched', result)
})

export const adminController = {
    getMe,
    listCreditRequests,
    approveCreditRequest,
    rejectCreditRequest,
    listFeedback,
    listUsers,
    getUser,
    listUserSessions,
    openUserSession,
    adjustCredits,
    restoreUser,
    listRedeemCodes,
    createRedeemCode,
    listInstallations,
    assignInstallation,
    listAnnouncements,
    sendTestAnnouncement,
    sendAnnouncement,
    listSandboxes,
    controlSandbox,
    dailyUsage,
    listAuditLog,
}
