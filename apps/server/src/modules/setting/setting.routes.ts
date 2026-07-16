import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { settingController } from './setting.controller'

const settingRouter = Router()

settingRouter.use(authMiddleware)

settingRouter.get('/me', settingController.getMe)
settingRouter.get('/', settingController.getProfile)
settingRouter.patch('/name', settingController.updateName)
settingRouter.patch('/username', settingController.updateUsername)
settingRouter.patch('/avatar', settingController.updateAvatarUrl)
settingRouter.patch('/password', settingController.changePassword)
settingRouter.patch('/notifications', settingController.updateNotifications)
settingRouter.patch('/onboarding', settingController.completeOnboarding)

settingRouter.post('/suggestions', settingController.chatSuggestions)
settingRouter.post('/sound', settingController.generationSound)
settingRouter.get('/design', settingController.getdesign)
settingRouter.post('/design', settingController.updatedesign)
settingRouter.delete('/design', settingController.deletedesign)

export default settingRouter
