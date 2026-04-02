import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { canvasController } from './canvas.controller'

const canvasRouter = Router()

canvasRouter.use(authMiddleware)
canvasRouter.post('/web-clips', canvasController.createWebClips)

export default canvasRouter
