import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

platformRouter.use(authMiddleware)

platformRouter.get('/:projectId/download', platformController.downloadProjectVersion)
platformRouter.post('/:projectId/december/deploy', platformController.deployDecemberProject)
platformRouter.post('/:projectId/vercel/deploy', platformController.deployVercelProject)
platformRouter.get('/:deploymentId/status', platformController.getVercelDeploymentStatus)
platformRouter.get('/:deploymentId/logs', platformController.streamVercelBuildLogs)

export default platformRouter
