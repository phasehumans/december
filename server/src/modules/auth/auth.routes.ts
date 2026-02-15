import { Router } from "express";
import { authController } from "./auth.controller";

const authRouter = Router()

authRouter.post('/signup', authController.signup)
authRouter.post('/login', authController.login)

authRouter.get('/me', authController.getMe)
authRouter.post('/logout', authController.logout)
authRouter.patch('/change-password', authController.changePassword)


export default authRouter