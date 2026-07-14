import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import * as sessionController from './session.controller'

const sessionRouter = Router()

sessionRouter.use(authMiddleware)

sessionRouter.get('/', sessionController.getSessionsHandler)
sessionRouter.post('/', sessionController.createSessionHandler)
sessionRouter.get('/:id', sessionController.getSessionByIdHandler)
sessionRouter.put('/:id', sessionController.updateSessionHandler)

export default sessionRouter
