import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { profileController } from './profile.controller'

const profileRouter = Router()

profileRouter.use(authMiddleware)
profileRouter.get('/', profileController.getProfile)
profileRouter.patch('/update-name', profileController.updateName)
profileRouter.patch('/change-password', profileController.changePassword)
profileRouter.post('/connect-github', profileController.connectGithub)

export default profileRouter
