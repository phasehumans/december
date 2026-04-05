import { Router } from 'express'

import { authController } from './auth.controller'

const authRouter = Router()

authRouter.post('/signup', authController.signup)
authRouter.post('/verify-otp', authController.verifyOtp)
authRouter.post('/login', authController.login)
authRouter.post('/google', authController.google)

export default authRouter
