import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { generateContoller } from './generation.controller'

const generateRouter = Router()

generateRouter.use(authMiddleware)
generateRouter.post('/', generateContoller.generateWebsite)

export default generateRouter
