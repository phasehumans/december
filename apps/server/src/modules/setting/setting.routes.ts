import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { settingController } from './setting.controller'

const settingRouter = Router()

settingRouter.use(authMiddleware)

settingRouter.get('/me', settingController.getMe)
settingRouter.get('/', settingController.getProfile)
settingRouter.patch('/name', settingController.updateName)
settingRouter.patch('/notifications', settingController.updateNotifications)
settingRouter.patch('/model-source', settingController.updateModelSource)
settingRouter.get('/onboarding', settingController.getOnboarding)
settingRouter.patch('/onboarding', settingController.updateOnboarding)
settingRouter.post('/onboarding/complete', settingController.completeOnboarding)

settingRouter.post('/feedback', settingController.submitFeedback)

export default settingRouter
