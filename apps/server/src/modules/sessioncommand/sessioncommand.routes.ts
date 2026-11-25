import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { sessionCommandController } from './sessioncommand.controller'

// /compact, /btw and titles call a model; /codesearch and /tasks reach the machine
const modelCommandLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: 20,
    message: 'Too many commands. Try again in a minute.',
    prefix: 'rl:session-command-model:',
})

// the slash commands of a session (#632 section 3). mounted on /session before the
// session router, so "check" and "review" are not read as a session id
const sessionCommandRouter = Router()

sessionCommandRouter.use(authMiddleware)

sessionCommandRouter.get('/check', sessionCommandController.getCheck)
sessionCommandRouter.post('/review', sessionCommandController.startReview)
sessionCommandRouter.get('/:id/context', sessionCommandController.getContext)
sessionCommandRouter.post(
    '/:id/compact',
    modelCommandLimiter,
    sessionCommandController.compactSession
)
sessionCommandRouter.post('/:id/clear', sessionCommandController.clearSession)
sessionCommandRouter.post('/:id/fork', sessionCommandController.forkSession)
sessionCommandRouter.get('/:id/turns', sessionCommandController.listTurns)
sessionCommandRouter.post('/:id/rewind', sessionCommandController.rewindSession)
sessionCommandRouter.post('/:id/btw', modelCommandLimiter, sessionCommandController.askSideQuestion)
sessionCommandRouter.post('/:id/title', modelCommandLimiter, sessionCommandController.generateTitle)
sessionCommandRouter.get('/:id/code-search', sessionCommandController.searchCode)
sessionCommandRouter.get('/:id/tasks', sessionCommandController.listTasks)
sessionCommandRouter.get('/:id/usage', sessionCommandController.getUsage)

export default sessionCommandRouter
