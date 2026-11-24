import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import {
    authRateLimiter,
    refreshRateLimiter,
    deviceCodeLimiter,
    deviceTokenPollLimiter,
} from '../../middleware/rate-limiter'

import { authController } from './auth.controller'

const authRouter = Router()

authRouter.post('/email/start', authRateLimiter, authController.startEmailAuth)
authRouter.post('/email/verify', authRateLimiter, authController.verifyEmailAuth)
authRouter.post('/google', authRateLimiter, authController.google)
authRouter.post('/github', authRateLimiter, authController.github)
authRouter.post('/refresh', refreshRateLimiter, authController.refreshSession)
authRouter.post('/signout', authMiddleware, authController.signout)
authRouter.post('/signout/all', authMiddleware, authController.signoutAll)
authRouter.delete('/account', authMiddleware, authController.deleteAccount)

authRouter.get('/device/status', authMiddleware, authController.getDeviceStatus)
authRouter.post('/device/code', deviceCodeLimiter, authController.generateDeviceCode)
authRouter.post('/device/token', deviceTokenPollLimiter, authController.pollDeviceToken)
authRouter.post('/device/verify', authMiddleware, authController.verifyUserCode)

export default authRouter
