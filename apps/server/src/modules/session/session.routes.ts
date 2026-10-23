import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { sessionController } from './session.controller'

const sessionRouter = Router()

sessionRouter.use(authMiddleware)

sessionRouter.get('/', sessionController.getSessions)
sessionRouter.post('/', sessionController.createSession)
sessionRouter.get('/:id', sessionController.getSessionById)
sessionRouter.get('/:id/messages', sessionController.getSessionMessages)
sessionRouter.patch('/:id/rename', sessionController.renameSession)
sessionRouter.patch('/:id/archive', sessionController.archiveSession)
sessionRouter.patch('/:id/unarchive', sessionController.unarchiveSession)
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
sessionRouter.post('/:id/question-answer', sessionController.submitQuestionAnswer)
sessionRouter.get('/:id/pending-question', sessionController.getPendingQuestion)
sessionRouter.post('/:id/disconnect', sessionController.disconnectSession)
sessionRouter.post('/:id/search/stream', sessionController.streamSearchResponse)
sessionRouter.all('/:id/preview/:port', sessionController.proxyPreview)
sessionRouter.all('/:id/preview', sessionController.proxyPreview)

export default sessionRouter
