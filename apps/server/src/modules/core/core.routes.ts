import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { coreController } from './core.controller'

const coreRouter = Router()

coreRouter.use(authMiddleware)
coreRouter.post('/prompt', coreController.handlePrompt)

export default coreRouter
