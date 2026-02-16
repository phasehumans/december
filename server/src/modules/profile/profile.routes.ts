import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";

const profileRouter = Router()

profileRouter.use(authMiddleware)
profileRouter.get('/me')
profileRouter.patch('/update-name')
profileRouter.patch('/change-password')

export default profileRouter