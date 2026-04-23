import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { uploadController } from './upload.controller'

const uploadRouter = Router()

uploadRouter.use(authMiddleware)
uploadRouter.post('/repo', uploadController.uploadRepo)
uploadRouter.post('/zip', uploadController.uploadZip)

export default uploadRouter
