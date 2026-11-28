import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { settingController } from './setting.controller'

// each feedback is a row and a note in every admin's inbox: a per-user limit keeps one
// account from filling them
const feedbackLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Too much feedback at once. Try again in an hour.',
    prefix: 'rl:setting-feedback:',
})

const settingRouter = Router()

// public: the link in announcement emails carries a signed token instead of a session
settingRouter.get('/unsubscribe', settingController.showUnsubscribe)
settingRouter.post('/unsubscribe', settingController.unsubscribe)

settingRouter.use(authMiddleware)

settingRouter.get('/me', settingController.getMe)
settingRouter.get('/', settingController.getProfile)
settingRouter.patch('/name', settingController.updateName)
settingRouter.patch('/notifications', settingController.updateNotifications)
settingRouter.patch('/defaults', settingController.updateSessionDefaults)
settingRouter.get('/permissions', settingController.getToolDenyRules)
settingRouter.put('/permissions', settingController.updateToolDenyRules)
settingRouter.patch('/preferences', settingController.updatePreferences)
settingRouter.get('/pull-requests', settingController.getPullRequestSettings)
settingRouter.patch('/pull-requests', settingController.updatePullRequestSettings)
settingRouter.get('/sandbox', settingController.getSandboxSettings)
settingRouter.patch('/sandbox', settingController.updateSandboxSettings)
settingRouter.get('/onboarding', settingController.getOnboarding)
settingRouter.patch('/onboarding', settingController.updateOnboarding)
settingRouter.post('/onboarding/complete', settingController.completeOnboarding)

settingRouter.post('/feedback', feedbackLimiter, settingController.submitFeedback)

export default settingRouter
