import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { usageController } from './usage.controller'
const usageRouter = Router()

usageRouter.use(authMiddleware)
usageRouter.get('/', usageController.getCurrentUsage)
usageRouter.get('/check', usageController.checkEnoughCredits)

export default usageRouter
