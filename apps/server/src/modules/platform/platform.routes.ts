import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

// webhooks (must be before auth middleware)
platformRouter.post('/vercel/webhook', platformController.handleVercelWebhook)

// protected routes
platformRouter.use(authMiddleware)

// general
platformRouter.get('/:sessionId/download', platformController.downloadProject)
platformRouter.post('/:sessionId/env/sync', platformController.syncEnvironmentVariables)

// vercel
platformRouter.post('/:sessionId/vercel/deploy', platformController.deployVercelProject)
platformRouter.post('/:sessionId/vercel/unlink', platformController.unlinkVercelProject)
platformRouter.get('/:deploymentId/status', platformController.getVercelDeploymentStatus)
platformRouter.get('/:deploymentId/logs', platformController.streamVercelBuildLogs)
platformRouter.post('/:deploymentId/cancel', platformController.cancelVercelDeployment)

// github
platformRouter.get('/github/repos', platformController.getUserGithubRepos)
platformRouter.post('/sessions/:sessionId/github/repository', platformController.createRepo)
platformRouter.post('/sessions/:sessionId/github/sync', platformController.updateRepo)
platformRouter.post('/sessions/:sessionId/github/unlink', platformController.unlinkGithubRepo)

export default platformRouter
