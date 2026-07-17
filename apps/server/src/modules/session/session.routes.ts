import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import * as sessionController from './session.controller'

const sessionRouter = Router()

sessionRouter.use(authMiddleware)

sessionRouter.get('/', sessionController.getSessionsHandler)
sessionRouter.post('/', sessionController.createSessionHandler)
sessionRouter.get('/:id', sessionController.getSessionByIdHandler)
sessionRouter.put('/:id', sessionController.updateSessionHandler)
sessionRouter.patch('/:id/settings', sessionController.updateSessionSettingsHandler)
sessionRouter.delete('/:id', sessionController.deleteSessionHandler)
sessionRouter.post('/:id/duplicate', sessionController.duplicateSessionHandler)

sessionRouter.get('/:id/collaborators', sessionController.getCollaboratorsHandler)
sessionRouter.post('/:id/collaborators', sessionController.addCollaboratorHandler)
sessionRouter.delete('/:id/collaborators/:email', sessionController.removeCollaboratorHandler)

export default sessionRouter
