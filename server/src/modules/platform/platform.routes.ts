import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

platformRouter.use(authMiddleware)

platformRouter.post('/:projectId/deploy/december', platformController.deployDecemberProject)
platformRouter.get('/:projectId/download', platformController.downloadProjectVersion)

// Vercel Auto-Deployment Endpoints
platformRouter.post('/projects/:projectId/vercel/deploy', platformController.deployVercelProject)
platformRouter.get(
    '/deployments/:deploymentId/status',
    platformController.getVercelDeploymentStatus
)
platformRouter.get('/deployments/:deploymentId/logs', platformController.streamVercelBuildLogs)

export default platformRouter
