import { Router } from 'express'
import * as sessionController from './session.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

const sessionRouter = Router()

sessionRouter.use(authMiddleware)

sessionRouter.get('/', sessionController.getSessionsHandler)
sessionRouter.post('/', sessionController.createSessionHandler)
sessionRouter.get('/:id', sessionController.getSessionByIdHandler)
sessionRouter.put('/:id', sessionController.updateSessionHandler)

export default sessionRouter
