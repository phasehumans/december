import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { usageController } from './usage.controller'
const usageRouter = Router()

usageRouter.use(authMiddleware)
usageRouter.get('/show-usage', usageController.getCurrentUsage)

export default usageRouter
