import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

// Webhooks (must be before auth middleware)
platformRouter.post('/vercel/webhook', platformController.handleVercelWebhook)

// Protected routes
platformRouter.use(authMiddleware)

// General
platformRouter.get('/:projectId/download', platformController.downloadProject)
platformRouter.post('/:projectId/december/deploy', platformController.deployDecemberProject)
platformRouter.post('/:projectId/env/sync', platformController.syncEnvironmentVariables)

// Vercel
platformRouter.post('/:projectId/vercel/deploy', platformController.deployVercelProject)
platformRouter.post('/:projectId/vercel/unlink', platformController.unlinkVercelProject)
platformRouter.get('/:deploymentId/status', platformController.getVercelDeploymentStatus)
platformRouter.get('/:deploymentId/logs', platformController.streamVercelBuildLogs)
platformRouter.post('/:deploymentId/cancel', platformController.cancelVercelDeployment)

// Github
platformRouter.get('/github/repos', platformController.getUserGithubRepos)
platformRouter.post('/projects/:projectId/github/repository', platformController.createRepo)
platformRouter.post('/projects/:projectId/github/sync', platformController.updateRepo)
platformRouter.post('/projects/:projectId/github/unlink', platformController.unlinkGithubRepo)

export default platformRouter
