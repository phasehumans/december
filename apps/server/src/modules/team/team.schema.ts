import { z } from 'zod'

// every team route works on the user's own team. teamId names another team the user is in
export const TeamQuerySchema = z.object({
    teamId: z.string().uuid('team id must be a valid UUID').optional(),
})

const inviteRole = z.enum(['ADMIN', 'MEMBER'], { message: "role must be 'ADMIN' or 'MEMBER'" })

export const CreateInviteSchema = z.object({
    email: z
        .string({ message: 'email is required' })
        .trim()
        .toLowerCase()
        .max(254)
        .email('please enter a valid email address'),
    role: inviteRole,
})

const inviteToken = z.string({ message: 'token is required' }).min(1).max(200)

export const InviteTokenParamsSchema = z.object({ token: inviteToken })

export const AcceptInviteSchema = z.object({ token: inviteToken })

export const InviteParamsSchema = z.object({
    id: z.string().uuid('invite id must be a valid UUID'),
})

export const MemberParamsSchema = z.object({
    userId: z.string().uuid('user id must be a valid UUID'),
})

// the owner role is not in the list: ownership does not move
export const ChangeMemberRoleSchema = z.object({ role: inviteRole })

const auditFilter = {
    action: z.string().trim().min(1).max(100).optional(),
    actorId: z.string().uuid('actor id must be a valid UUID').optional(),
    from: z.coerce.date({ message: 'from must be a date' }).optional(),
    to: z.coerce.date({ message: 'to must be a date' }).optional(),
}

export const AuditQuerySchema = TeamQuerySchema.extend({
    ...auditFilter,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const AuditExportQuerySchema = TeamQuerySchema.extend(auditFilter)
