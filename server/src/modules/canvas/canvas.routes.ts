import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { canvasController } from './canvas.controller'
const canvasRouter = Router()

canvasRouter.use(authMiddleware)
canvasRouter.get('/web-clips', canvasController.getWebClips)

export default canvasRouter
