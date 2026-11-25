import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    AcceptInviteSchema,
    AuditExportQuerySchema,
    AuditQuerySchema,
    ChangeMemberRoleSchema,
    CreateInviteSchema,
    InviteParamsSchema,
    InviteTokenParamsSchema,
    MemberParamsSchema,
    TeamQuerySchema,
} from './team.schema'
import { teamService } from './team.service'

import type { Request, Response } from 'express'

const getTeam = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { teamId } = TeamQuerySchema.parse(req.query)
    const result = await teamService.getTeam({ userId, teamId })
    return sendSuccess(res, 'team fetched successfully', result)
})

const createInvite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { teamId } = TeamQuerySchema.parse(req.query)
    const body = CreateInviteSchema.parse(req.body)
    const result = await teamService.createInvite({
        userId,
        teamId,
        email: body.email,
        role: body.role,
        ip: req.ip,
    })
    return sendSuccess(res, 'invite sent successfully', result, 201)
})

const revokeInvite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { teamId } = TeamQuerySchema.parse(req.query)
    const { id } = InviteParamsSchema.parse(req.params)
    const result = await teamService.revokeInvite({ userId, teamId, inviteId: id, ip: req.ip })
    return sendSuccess(res, 'invite revoked successfully', result)
})

// no sign-in needed: the invite page shows this before the user signs in
const previewInvite = asyncHandler(async (req: Request, res: Response) => {
    const { token } = InviteTokenParamsSchema.parse(req.params)
    const result = await teamService.previewInvite({ token, viewerId: req.tokenUser?.userId })
    return sendSuccess(res, 'invite fetched successfully', result)
})

const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { token } = AcceptInviteSchema.parse(req.body)
    const result = await teamService.acceptInvite({ userId, token, ip: req.ip })
    return sendSuccess(res, 'team joined successfully', result)
})

const changeMemberRole = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { teamId } = TeamQuerySchema.parse(req.query)
    const params = MemberParamsSchema.parse(req.params)
    const { role } = ChangeMemberRoleSchema.parse(req.body)
    const result = await teamService.changeMemberRole({
        userId,
        teamId,
        memberUserId: params.userId,
        role,
        ip: req.ip,
    })
    return sendSuccess(res, 'role changed successfully', result)
})

const removeMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { teamId } = TeamQuerySchema.parse(req.query)
    const params = MemberParamsSchema.parse(req.params)
    const result = await teamService.removeMember({
        userId,
        teamId,
        memberUserId: params.userId,
        ip: req.ip,
    })
    return sendSuccess(res, 'member removed successfully', result)
})

const listAuditEvents = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const query = AuditQuerySchema.parse(req.query)
    const result = await teamService.listAuditEvents({ userId, ...query })
    return sendSuccess(res, 'audit log fetched successfully', result)
})

const exportAuditEvents = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const query = AuditExportQuerySchema.parse(req.query)
    const result = await teamService.exportAuditEvents({ userId, ...query })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
    return res.status(200).send(result.csv)
})

export const teamController = {
    getTeam,
    changeMemberRole,
    removeMember,
    createInvite,
    revokeInvite,
    previewInvite,
    acceptInvite,
    listAuditEvents,
    exportAuditEvents,
}
