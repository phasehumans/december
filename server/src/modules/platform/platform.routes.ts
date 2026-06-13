import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

platformRouter.use(authMiddleware)
platformRouter.post('/:projectId/deploy/december', platformController.deployDecemberProject)

export default platformRouter
