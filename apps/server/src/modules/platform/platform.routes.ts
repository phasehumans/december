import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

platformRouter.use(authMiddleware)

platformRouter.get('/:projectId/download', platformController.downloadProjectVersion)
platformRouter.post('/:projectId/vercel/deploy', platformController.deployVercelProject)
platformRouter.get('/:deploymentId/status', platformController.getVercelDeploymentStatus)
platformRouter.get('/:deploymentId/logs', platformController.streamVercelBuildLogs)

platformRouter.get('/github/repos', platformController.getUserGithubRepos)
platformRouter.post('/projects/:projectId/github/repository', platformController.createRepo)
platformRouter.post('/projects/:projectId/github/sync', platformController.updateRepo)

export default platformRouter
