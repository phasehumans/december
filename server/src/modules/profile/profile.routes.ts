import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { profileController } from './profile.controller'

const profileRouter = Router()

profileRouter.get('/connect-github', profileController.connectGithub)
profileRouter.use(authMiddleware)
profileRouter.get('/', profileController.getProfile)
profileRouter.patch('/update-name', profileController.updateName)
profileRouter.patch('/change-password', profileController.changePassword)
profileRouter.patch('/notification', profileController.updateNotification)

export default profileRouter
