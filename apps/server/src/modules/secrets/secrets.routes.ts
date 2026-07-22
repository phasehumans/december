import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { secretsController } from './secrets.controller'

const secretsRouter = Router()

secretsRouter.use(authMiddleware)

secretsRouter.get('/', secretsController.getSecrets)
secretsRouter.post('/', secretsController.createSecret)
secretsRouter.delete('/:name', secretsController.deleteSecret)

export default secretsRouter
