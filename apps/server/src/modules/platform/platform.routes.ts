import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { platformController } from './platform.controller'

const platformRouter = Router()

// protected routes
platformRouter.use(authMiddleware)

// general
platformRouter.get('/:sessionId/download', platformController.downloadProject)

// github
platformRouter.get('/github/repos', platformController.getUserGithubRepos)
platformRouter.post('/sessions/:sessionId/github/repository', platformController.createRepo)
platformRouter.post('/sessions/:sessionId/github/sync', platformController.updateRepo)
platformRouter.post('/sessions/:sessionId/github/unlink', platformController.unlinkGithubRepo)

export default platformRouter
