import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { integrationsController } from './integration.controller'

const integrationsRouter = Router()

integrationsRouter.get('/vercel/connect', integrationsController.connectVercel)
integrationsRouter.get('/github/connect', integrationsController.connectGithub)

integrationsRouter.get('/supabase/connect', integrationsController.connectSupabase)
integrationsRouter.get('/notion/connect', integrationsController.connectNotion)

integrationsRouter.use(authMiddleware)
integrationsRouter.get('/github/repos', integrationsController.getUserGithubRepos)

integrationsRouter.post('/projects/:projectId/github/repository', integrationsController.createRepo)
integrationsRouter.post('/projects/:projectId/github/sync', integrationsController.updateRepo)

export default integrationsRouter
