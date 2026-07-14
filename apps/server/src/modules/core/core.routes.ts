import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { handlePrompt } from './core.controller'

const coreRouter = Router()

coreRouter.use(authMiddleware)
coreRouter.post('/prompt', handlePrompt)

export default coreRouter
