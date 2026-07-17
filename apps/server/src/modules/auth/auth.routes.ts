import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { deviceCodeLimiter } from '../../middleware/rate-limiter'

import { authController } from './auth.controller'

const authRouter = Router()

authRouter.post('/signup', authController.signup)
authRouter.post('/verify', authController.verifyOtp)
authRouter.post('/login', authController.login)
authRouter.post('/forgot-password/request', authController.requestPasswordReset)
authRouter.post('/forgot-password/verify', authController.verifyPasswordResetOtp)
authRouter.post('/forgot-password/reset', authController.resetPassword)
authRouter.post('/google', authController.google)
authRouter.post('/github', authController.github)
authRouter.post('/refresh', authController.refreshSession)
authRouter.post('/signout', authMiddleware, authController.signout)
authRouter.post('/signout/all', authMiddleware, authController.signoutAll)
authRouter.delete('/account', authMiddleware, authController.deleteAccount)

authRouter.get('/cli-token', authMiddleware, authController.getCliToken)
authRouter.post('/device/code', deviceCodeLimiter, authController.generateDeviceCode)
authRouter.post('/device/token', deviceCodeLimiter, authController.pollDeviceToken)
authRouter.post('/device/verify', authMiddleware, authController.verifyUserCode)

export default authRouter
