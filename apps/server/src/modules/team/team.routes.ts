import { Router } from 'express'

import { env } from '../../env'
import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { teamController } from './team.controller'

const teamRouter = Router()

// an invite sends a mail, so it has its own limit for each user
const inviteLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 1000 : 30,
    message: 'Too many invites. Please try again later.',
    prefix: 'rl:team:invite:',
})

// the invite page reads the invite before the user signs in
teamRouter.get('/invites/:token', teamController.previewInvite)

teamRouter.use(authMiddleware)

teamRouter.get('/', teamController.getTeam)
teamRouter.post('/invites', inviteLimiter, teamController.createInvite)
teamRouter.post('/invites/accept', teamController.acceptInvite)
teamRouter.delete('/invites/:id', teamController.revokeInvite)
teamRouter.patch('/members/:userId', teamController.changeMemberRole)
teamRouter.delete('/members/:userId', teamController.removeMember)
teamRouter.get('/audit', teamController.listAuditEvents)
teamRouter.get('/audit/export', teamController.exportAuditEvents)

export default teamRouter
