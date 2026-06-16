import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { generateContoller } from './generation.controller'

const generateRouter = Router()

generateRouter.use(authMiddleware)
generateRouter.post('/', generateContoller.generateWebsite)
generateRouter.post('/edit', generateContoller.applyProjectEdit)
generateRouter.post('/fix', generateContoller.applyProjectFix)
generateRouter.post('/projects/:id/validate', generateContoller.validateProject)

export default generateRouter
