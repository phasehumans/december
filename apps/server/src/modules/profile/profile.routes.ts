import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { profileController } from './profile.controller'

const profileRouter = Router()

profileRouter.use(authMiddleware)

profileRouter.get('/info', profileController.getInfo)
profileRouter.get('/card', profileController.getProfileCard)
profileRouter.get('/', profileController.getProfile)
profileRouter.patch('/name', profileController.updateName)
profileRouter.patch('/username', profileController.updateUsername)
profileRouter.patch('/avatar', profileController.updateAvatarUrl)
profileRouter.patch('/password', profileController.changePassword)
profileRouter.patch('/notifications', profileController.updateNotifications)
profileRouter.patch('/onboarding', profileController.completeOnboarding)

profileRouter.post('/suggestions', profileController.chatSuggestions)
profileRouter.post('/sound', profileController.generationSound)
profileRouter.get('/design', profileController.getdesign)
profileRouter.post('/design', profileController.updatedesign)
profileRouter.delete('/design', profileController.deletedesign)

profileRouter.post('/feedback', profileController.submitFeedback)

export default profileRouter
