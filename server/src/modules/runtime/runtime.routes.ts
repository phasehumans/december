import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { runtimeController } from './runtime.controller'

const runtimeRouter = Router()

runtimeRouter.post('/previews/:id/callback', runtimeController.receiveRuntimeStatus)
runtimeRouter.use(authMiddleware)
runtimeRouter.post('/previews/start', runtimeController.startPreview)
runtimeRouter.get('/previews/:id/status', runtimeController.getPreviewStatus)
runtimeRouter.delete('/previews/:id', runtimeController.deletePreview)

export default runtimeRouter
