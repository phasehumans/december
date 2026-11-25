import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { settingController } from './setting.controller'

const settingRouter = Router()

// public: the link in announcement emails carries a signed token instead of a session
settingRouter.get('/unsubscribe', settingController.showUnsubscribe)
settingRouter.post('/unsubscribe', settingController.unsubscribe)

settingRouter.use(authMiddleware)

settingRouter.get('/me', settingController.getMe)
settingRouter.get('/', settingController.getProfile)
settingRouter.patch('/name', settingController.updateName)
settingRouter.patch('/notifications', settingController.updateNotifications)
settingRouter.patch('/model-source', settingController.updateModelSource)
settingRouter.get('/pull-requests', settingController.getPullRequestSettings)
settingRouter.patch('/pull-requests', settingController.updatePullRequestSettings)
settingRouter.get('/onboarding', settingController.getOnboarding)
settingRouter.patch('/onboarding', settingController.updateOnboarding)
settingRouter.post('/onboarding/complete', settingController.completeOnboarding)

settingRouter.post('/feedback', settingController.submitFeedback)

export default settingRouter
