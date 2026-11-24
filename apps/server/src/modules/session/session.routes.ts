import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { sessionController } from './session.controller'

// each smart search may call a model and charge credits; cap it per user
const smartSearchLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: 30,
    message: 'Too many searches. Try again in a minute.',
    prefix: 'rl:smart-search:',
})

const sessionRouter = Router()

sessionRouter.use(authMiddleware)

sessionRouter.get('/', sessionController.getSessions)
sessionRouter.post('/', sessionController.createSession)
// before '/:id', so "smart-search" and "counts" are not read as a session id
sessionRouter.get('/smart-search', smartSearchLimiter, sessionController.smartSearchSessions)
sessionRouter.get('/counts', sessionController.getSessionCounts)
sessionRouter.post('/archive-merged', sessionController.archiveMergedSessions)
sessionRouter.post('/unarchive', sessionController.unarchiveSessions)
sessionRouter.get('/:id', sessionController.getSessionById)
sessionRouter.get('/:id/messages', sessionController.getSessionMessages)
sessionRouter.patch('/:id/rename', sessionController.renameSession)
sessionRouter.patch('/:id/archive', sessionController.archiveSession)
sessionRouter.patch('/:id/unarchive', sessionController.unarchiveSession)
sessionRouter.patch('/:id/pin', sessionController.pinSession)
sessionRouter.patch('/:id/unpin', sessionController.unpinSession)
sessionRouter.put('/:id/tags', sessionController.updateSessionTags)
sessionRouter.delete('/:id', sessionController.deleteSession)
sessionRouter.get('/:id/rehydrate', sessionController.rehydrateSession)
sessionRouter.get('/:id/diff', sessionController.getSessionDiff)
sessionRouter.get('/:id/files', sessionController.getSessionFileTree)
sessionRouter.get('/:id/file', sessionController.getSessionFileContent)
sessionRouter.get('/:id/pull-requests', sessionController.getSessionPullRequests)
sessionRouter.get('/:id/plan', sessionController.getSessionPlan)
sessionRouter.get('/:id/tests', sessionController.getSessionTests)
sessionRouter.get('/:id/preview-port', sessionController.getSessionPreviewPort)
sessionRouter.post('/:id/preview-activity', sessionController.recordPreviewActivity)
sessionRouter.get('/:id/desktop-viewport', sessionController.getSessionDesktopViewport)
sessionRouter.post('/:id/question-answer', sessionController.submitQuestionAnswer)
sessionRouter.get('/:id/pending-question', sessionController.getPendingQuestion)
sessionRouter.post('/:id/disconnect', sessionController.disconnectSession)
sessionRouter.post('/:id/search/stream', sessionController.streamSearchResponse)
sessionRouter.all('/:id/preview/:port', sessionController.proxyPreview)
sessionRouter.all('/:id/preview', sessionController.proxyPreview)

export default sessionRouter
