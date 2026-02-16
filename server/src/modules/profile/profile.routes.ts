import { Router } from "express";

const profileRouter = Router()

profileRouter.get('/me')
profileRouter.patch('/update-name')
profileRouter.patch('/change-password')

export default profileRouter