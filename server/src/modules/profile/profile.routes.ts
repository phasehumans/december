import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { profileController } from './profile.controller'

const profileRouter = Router()

profileRouter.get('/github/connect', profileController.connectGithub)
profileRouter.use(authMiddleware)
profileRouter.get('/info', profileController.getInfo)
profileRouter.get('/card', profileController.getProfileCard)
profileRouter.get('/', profileController.getProfile)
profileRouter.patch('/name', profileController.updateName)
profileRouter.patch('/username', profileController.updateUsername)
profileRouter.patch('/password', profileController.changePassword)
profileRouter.patch('/notifications', profileController.updateNotifications)
profileRouter.post('/signout', profileController.signout)
profileRouter.post('/signout/all', profileController.signoutAll)
profileRouter.delete('/', profileController.deleteAccount)

profileRouter.post('/suggestions', profileController.chatSuggestions)
profileRouter.post('/sound', profileController.generationSound)

profileRouter.get('/memories', profileController.getMemories)
profileRouter.post('/memories', profileController.updateMemories)
profileRouter.delete('/memories', profileController.deleteMemories)

profileRouter.get('/skills', profileController.getSkills)
profileRouter.post('/skills', profileController.updateSkills)
profileRouter.delete('/skills', profileController.deleteSkills)

export default profileRouter
