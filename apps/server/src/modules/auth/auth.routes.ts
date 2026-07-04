import { Router } from 'express'

import { authController } from './auth.controller'
import { authDeviceController } from './auth.device.controller'

const authRouter = Router()

authRouter.post('/signup', authController.signup)
authRouter.post('/verify', authController.verifyOtp)
authRouter.post('/login', authController.login)
authRouter.post('/forgot-password/request', authController.requestPasswordReset)
authRouter.post('/forgot-password/verify', authController.verifyPasswordResetOtp)
authRouter.post('/forgot-password/reset', authController.resetPassword)
authRouter.post('/google', authController.google)
authRouter.post('/refresh', authController.refreshSession)

import { authMiddleware } from '../../middleware/auth.middleware'

// add cli auth via code (ref devin authflow)
authRouter.get('/cli-token', authMiddleware, authController.getCliToken)

// Device Code Flow
authRouter.post('/device/code', authDeviceController.generateDeviceCode)
authRouter.post('/device/token', authDeviceController.pollDeviceToken)
authRouter.post('/device/verify', authMiddleware, authDeviceController.verifyUserCode)

export default authRouter
