import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { profileController } from './profile.controller'

const profileRouter = Router()

profileRouter.get('/github/connect', profileController.connectGithub)
profileRouter.use(authMiddleware)
profileRouter.get('/', profileController.getProfile)
profileRouter.get('/quickinfo', profileController.getQuickInfo)
profileRouter.patch('/name', profileController.updateName)
profileRouter.patch('/username', profileController.updatedUsername)
profileRouter.patch('/password', profileController.changePassword)
profileRouter.patch('/notifications', profileController.updateNotifications)
profileRouter.post('/signout')
profileRouter.post('/signout/all')
profileRouter.delete('/')

export default profileRouter
